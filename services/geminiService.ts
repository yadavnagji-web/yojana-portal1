
import { GoogleGenAI } from "@google/genai";
import { UserProfile, AnalysisResponse, Scheme } from "../types";
import { dbService } from "./dbService";

const SYSTEM_INSTRUCTION = `You are a Lead Welfare Policy Architect for India and Rajasthan. 
Target Period: 2024-25 and 2026.

STRICT JSON OUTPUT RULES:
1. All descriptions, reasons, and names MUST be in Hindi.
2. Return a JSON object with the key "eligible_schemes".
3. NO EMPTY RESULTS: If the user is not 100% eligible for anything, you MUST suggest 5 schemes as "CONDITIONAL" based on their category (SC/ST/OBC), gender, or occupation (Farmer/Worker).
4. MANDATORY ROADMAP DATA: Every scheme must have "signatures_required" (e.g. Patwari, Sarpanch), "submission_point", and "application_type".
5. Wrap JSON with ---JSON_START--- and ---JSON_END---.

Schema for schemes:
{
  "yojana_name": "In Hindi",
  "government": "Rajasthan Govt" | "Central Govt",
  "short_purpose_hindi": "...",
  "detailed_benefits": "...",
  "eligibility_status": "ELIGIBLE" | "CONDITIONAL",
  "eligibility_reason_hindi": "...",
  "required_documents": ["..."],
  "form_source": "e-Mitra / Portal",
  "application_type": "Online / Offline",
  "signatures_required": ["..."],
  "submission_point": "...",
  "official_pdf_link": "..."
}`;

async function hashProfile(profile: UserProfile): Promise<string> {
  const msgUint8 = new TextEncoder().encode(JSON.stringify(profile));
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function cleanAndParseJson(text: string): any {
  if (!text) return null;
  try {
    const taggedMatch = text.match(/---JSON_START---([\s\S]*?)---JSON_END---/);
    if (taggedMatch) return JSON.parse(taggedMatch[1].trim());
    const mdMatch = text.match(/```json\s*([\s\S]*?)\s*```/i);
    if (mdMatch) return JSON.parse(mdMatch[1].trim());
    const arrayMatch = text.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (arrayMatch) return JSON.parse(arrayMatch[0].trim());
  } catch (e) {
    console.error("JSON Parsing Error:", e);
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

  const prompt = `Analyze this profile for 2024-2026 Rajasthan & Central schemes: ${JSON.stringify(profile)}.
Provide schemes for Farming, Education, and Social Security. Focus on Rajasthan-specific benefits.
Include signature details (Patwari/Sarpanch) for each.`;

  let finalRawText = "";
  let groundingSources: any[] = [];

  // 1. First Priority: Groq (Llama 3.3 70B for fast reasoning)
  if (groqKey && groqKey.trim().startsWith('gsk_')) {
    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${groqKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "system", content: SYSTEM_INSTRUCTION }, { role: "user", content: prompt }],
          temperature: 0.1
        })
      });
      const data = await response.json();
      finalRawText = data.choices?.[0]?.message?.content || "";
    } catch (e) {
      console.warn("Groq Error, switching to Gemini...");
    }
  }

  // 2. Second Priority/Fallback: Gemini 3 Pro (with Google Search)
  if (!finalRawText && geminiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey: geminiKey });
      const result = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: { systemInstruction: SYSTEM_INSTRUCTION, tools: [{ googleSearch: {} }] }
      });
      finalRawText = result.text || "";
      groundingSources = result.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    } catch (e) {
      console.error("Gemini Error:", e);
    }
  }

  if (!finalRawText) {
    throw new Error("Result नहीं मिल रहा है। कृपया Admin में Groq या Gemini Key जांचें।");
  }

  const parsed = cleanAndParseJson(finalRawText);
  let schemes = parsed?.eligible_schemes || (Array.isArray(parsed) ? parsed : []);

  // Guarantee minimum data structure
  schemes = schemes.map((s: any) => ({
    ...s,
    government: s.government || 'Rajasthan Govt',
    eligibility_status: s.eligibility_status || 'ELIGIBLE',
    yojana_name: s.yojana_name || 'योजना का नाम प्राप्त नहीं हुआ',
    signatures_required: Array.isArray(s.signatures_required) ? s.signatures_required : ["स्वयं के हस्ताक्षर"]
  }));

  const response: AnalysisResponse = {
    hindiContent: finalRawText.split(/---JSON_START---|```json|\[/)[0].trim(),
    eligible_schemes: schemes,
    groundingSources,
    timestamp: Date.now()
  };

  if (!isDummy && schemes.length > 0) {
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
    const result = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Search 10 latest ${category} schemes for 2024-2026. Return as JSON with full roadmap.`,
      config: { tools: [{ googleSearch: {} }] }
    });
    const parsed = cleanAndParseJson(result.text || "");
    const list = parsed?.eligible_schemes || (Array.isArray(parsed) ? parsed : []);
    for (const s of list) { if (s.yojana_name) await dbService.upsertScheme(s); }
  } catch (e) { console.error("Master Sync failed"); }
}
