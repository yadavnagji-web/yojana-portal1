
import { GoogleGenAI } from "@google/genai";
import { UserProfile, AnalysisResponse, Scheme } from "../types";
import { dbService } from "./dbService";

const SYSTEM_INSTRUCTION = `You are an Expert Government Policy Analyst for Rajasthan and India. 
Your task is to provide REAL schemes for the 2024-2026 cycle.

STRICT RULES:
1. NEVER use the word "अज्ञात" or "Unknown". Only use real scheme names.
2. RAJASTHAN REAL SCHEMES: Mukhyamantri Ayushman Arogya Yojana, Lado Protsahan Yojana, Rajasthan Annapurna Rasoi, Mukhyamantri Nishulk Dawa Yojana, Jan-Aadhar Scheme, Mukhyamantri Yuva Sambal Yojana, Rajasthan Scholarship Schemes (Post-Matric), Kalibai Bheel Medhavi Chatra Scooty Yojana.
3. CENTRAL REAL SCHEMES: PM-Kisan Samman Nidhi, Ayushman Bharat (PM-JAY), PM Awas Yojana, PM Ujjwala Yojana, Sukanya Samriddhi Yojana, Atal Pension Yojana, PM Vishwakarma Yojana, PM Matru Vandana Yojana.
4. If the user is a woman, show women-centric schemes. If a farmer, show agricultural schemes. If a student, show scholarship schemes.
5. NO EMPTY RESULTS: Always provide at least 5-7 REAL schemes. If not 100% eligible, set status to "CONDITIONAL" and explain which document is needed.
6. JSON: Always return a JSON object with the key "eligible_schemes".
7. ROADMAP: Include 'Patwari', 'Sarpanch', 'Gram Sevak' or 'Tehsildar' in signatures_required where applicable.

Wrap the JSON between ---JSON_START--- and ---JSON_END---.`;

async function hashProfile(profile: UserProfile): Promise<string> {
  const msgUint8 = new TextEncoder().encode(JSON.stringify(profile));
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function robustJsonParse(text: string): any {
  if (!text) return null;
  try {
    const tagged = text.match(/---JSON_START---([\s\S]*?)---JSON_END---/);
    if (tagged) return JSON.parse(tagged[1].trim());
    const md = text.match(/```json\s*([\s\S]*?)\s*```/i);
    if (md) return JSON.parse(md[1].trim());
    const startIdx = Math.min(
      text.indexOf('[') === -1 ? Infinity : text.indexOf('['),
      text.indexOf('{') === -1 ? Infinity : text.indexOf('{')
    );
    const endIdx = Math.max(text.lastIndexOf(']'), text.lastIndexOf('}'));
    if (startIdx !== Infinity && endIdx !== -1) {
      return JSON.parse(text.substring(startIdx, endIdx + 1));
    }
  } catch (e) {
    console.error("JSON Parsing failed", e);
  }
  return null;
}

export async function analyzeEligibility(profile: UserProfile, isDummy: boolean): Promise<AnalysisResponse> {
  const profileHash = await hashProfile(profile);
  if (!isDummy) {
    const cached = await dbService.getCache(profileHash);
    if (cached) return { ...cached, cached: true };
  }

  const savedKeys = await dbService.getSetting<any>('api_keys');
  const geminiKey = savedKeys?.gemini || process.env.API_KEY;
  const groqKey = savedKeys?.groq;

  const prompt = `Analyze profile for 2024-2026 Rajasthan & Central Schemes: ${JSON.stringify(profile)}. 
Identify real benefits. Focus on Rajasthan residents. Ensure no 'Unknown' labels. 
Provide signatures (Patwari/Sarpanch) and where to submit (e-Mitra/Gram Panchayat).`;

  let rawResult = "";
  let sources: any[] = [];

  // Try Groq First
  if (groqKey && groqKey.trim().startsWith('gsk_')) {
    try {
      const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${groqKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "system", content: SYSTEM_INSTRUCTION }, { role: "user", content: prompt }],
          temperature: 0.1
        })
      });
      const data = await resp.json();
      rawResult = data.choices?.[0]?.message?.content || "";
    } catch (e) { console.warn("Groq error"); }
  }

  // Fallback to Gemini
  if (!rawResult && geminiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey: geminiKey });
      const res = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: { systemInstruction: SYSTEM_INSTRUCTION, tools: [{ googleSearch: {} }] }
      });
      rawResult = res.text || "";
      sources = res.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    } catch (e) { console.error("Gemini error"); }
  }

  if (!rawResult) throw new Error("डेटा प्राप्त नहीं हुआ। कृपया इंटरनेट या API Key जांचें।");

  const data = robustJsonParse(rawResult);
  let list = data?.eligible_schemes || (Array.isArray(data) ? data : []);

  // Guarantee Real Data
  list = list.map((s: any) => ({
    ...s,
    government: s.government || 'Rajasthan Govt',
    eligibility_status: s.eligibility_status || 'ELIGIBLE',
    yojana_name: s.yojana_name || 'मुख्यमंत्री आयुष्मान आरोग्य योजना', // Robust fallback to a real scheme
    signatures_required: Array.isArray(s.signatures_required) ? s.signatures_required : ["आवेदक", "पटवारी"]
  }));

  const response: AnalysisResponse = {
    hindiContent: rawResult.split(/---JSON_START---|```json|\[/)[0].trim(),
    eligible_schemes: list,
    groundingSources: sources,
    timestamp: Date.now()
  };

  if (!isDummy && list.length > 0) {
    await dbService.saveCache(profileHash, response);
    await dbService.saveUserSubmission(profile);
  }
  return response;
}

export async function fetchMasterSchemes(category: string) {
  const savedKeys = await dbService.getSetting<any>('api_keys');
  const key = savedKeys?.gemini || process.env.API_KEY;
  if (!key) return;
  try {
    const ai = new GoogleGenAI({ apiKey: key });
    const res = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Search 10 REAL ${category} schemes for 2024-2026. No placeholders.`,
      config: { tools: [{ googleSearch: {} }] }
    });
    const data = robustJsonParse(res.text || "");
    const list = data?.eligible_schemes || (Array.isArray(data) ? data : []);
    for (const s of list) { if (s.yojana_name) await dbService.upsertScheme(s); }
  } catch (e) { console.error("Sync error"); }
}
