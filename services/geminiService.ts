
import { GoogleGenAI } from "@google/genai";
import { UserProfile, AnalysisResponse, Scheme } from "../types";
import { dbService } from "./dbService";

const SYSTEM_INSTRUCTION = `You are the Lead Welfare Architect for India & Rajasthan. 
Your goal is to provide a comprehensive list of eligible welfare schemes for the 2024-25 and 2026 cycles.

STRICT JSON OUTPUT RULES:
1. Always return a JSON object with the key "eligible_schemes".
2. If no schemes are a 100% match, return schemes where the user is "CONDITIONAL".
3. Use Hindi for text fields like yojana_name, short_purpose_hindi, eligibility_reason_hindi.
4. Surround the JSON with ---JSON_START--- and ---JSON_END---.

JSON Schema for each item:
{
  "yojana_name": "Scheme Name",
  "government": "Rajasthan Govt" | "Central Govt",
  "category": "e.g. Health, Education, Farming",
  "short_purpose_hindi": "...",
  "detailed_benefits": "...",
  "eligibility_criteria": ["..."],
  "eligibility_status": "ELIGIBLE" | "NOT_ELIGIBLE" | "CONDITIONAL",
  "eligibility_reason_hindi": "...",
  "required_documents": ["..."],
  "form_source": "...",
  "application_type": "Online" | "Offline" | "Both",
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

function extractJson(text: string): any {
  if (!text) return null;
  try {
    // Attempt 1: Custom tags
    const customMatch = text.match(/---JSON_START---([\s\S]*?)---JSON_END---/);
    if (customMatch) return JSON.parse(customMatch[1].trim());

    // Attempt 2: Markdown block
    const markdownMatch = text.match(/```json\s*([\s\S]*?)\s*```/i);
    if (markdownMatch) return JSON.parse(markdownMatch[1].trim());

    // Attempt 3: Any JSON array
    const arrayMatch = text.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (arrayMatch) return JSON.parse(arrayMatch[0].trim());
    
    // Attempt 4: Any JSON object
    const objectMatch = text.match(/\{\s*"eligible_schemes"[\s\S]*\}/);
    if (objectMatch) return JSON.parse(objectMatch[0].trim());
  } catch (e) {
    console.error("JSON Extraction failed:", e);
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

  let rawText = "";
  let groundingSources: any[] = [];

  const prompt = `Profile: ${JSON.stringify(profile)}.
Find schemes for 2024-25 and 2026 for Rajasthan and Central Govt.
Be specific about the "Application Process" (signatures and submission points).
Return a Hindi summary followed by the JSON.`;

  // Attempt Groq
  if (groqKey && groqKey.startsWith('gsk_')) {
    try {
      const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'system', content: SYSTEM_INSTRUCTION }, { role: 'user', content: prompt }],
          temperature: 0.1
        })
      });
      const data = await resp.json();
      rawText = data.choices?.[0]?.message?.content || "";
    } catch (e) { console.error("Groq failed:", e); }
  }

  // Attempt Gemini (with Search)
  if (!rawText && geminiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey: geminiKey });
      const result = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          tools: [{ googleSearch: {} }]
        }
      });
      rawText = result.text || "";
      groundingSources = result.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    } catch (e) { console.error("Gemini failed:", e); }
  }

  if (!rawText) throw new Error("Could not connect to AI services. Please check keys.");

  const data = extractJson(rawText);
  let schemes = data?.eligible_schemes || (Array.isArray(data) ? data : []);

  // Ensure mandatory fields
  schemes = schemes.map((s: any) => ({
    ...s,
    government: s.government || 'Rajasthan Govt',
    eligibility_status: s.eligibility_status || 'ELIGIBLE'
  }));

  const response: AnalysisResponse = {
    hindiContent: rawText.split(/---JSON_START---|```json|\[/)[0].trim(),
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
      contents: `Fetch 15 major ${category} schemes for 2024-2026 with full metadata as JSON.`,
      config: { tools: [{ googleSearch: {} }] }
    });
    const data = extractJson(result.text || "");
    const list = data?.eligible_schemes || (Array.isArray(data) ? data : []);
    for (const s of list) { if (s.yojana_name) await dbService.upsertScheme(s); }
  } catch (e) { console.error("Sync failed:", e); }
}
