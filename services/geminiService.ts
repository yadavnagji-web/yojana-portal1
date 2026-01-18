
import { GoogleGenAI } from "@google/genai";
import { UserProfile, AnalysisResponse, Scheme } from "../types";
import { dbService } from "./dbService";

const SYSTEM_INSTRUCTION = `You are an Expert Government Policy Analyst specializing in Live Search.
Your task is to identify ELIGIBLE welfare schemes for a user by searching OFFICIAL GOVERNMENT WEBSITES ONLY.

SOURCES: 
- Rajasthan Government (e.g., rajasthan.gov.in, sso.rajasthan.gov.in, dipr.rajasthan.gov.in)
- Government of India (e.g., india.gov.in, myscheme.gov.in, pib.gov.in)

STRICT RULES:
1. NO PRE-FED DATA: Do not use any hardcoded lists. Use the 'googleSearch' tool for every query to find 2024-2025 and 2026 active schemes.
2. ACCURACY: Only return schemes where the user profile realistically matches the criteria.
3. LANGUAGE: All output text (names, descriptions, reasons) MUST be in Hindi (Devanagari).
4. MANDATORY FIELDS: Every scheme must include:
   - yojana_name (Real name in Hindi)
   - government (Rajasthan Govt or Central Govt)
   - detailed_benefits (Specific financial or social benefits)
   - eligibility_reason_hindi (Why this specific user is eligible)
   - required_documents (List of actual docs needed)
   - form_source (URL or specific portal name like e-Mitra)
   - application_type (Online/Offline)
   - signatures_required (e.g., Patwari, Sarpanch)
   - submission_point (Where to submit)
   - official_pdf_link (Direct link to the portal or guideline)

5. JSON FORMAT: Return the final list as a JSON object with the key "eligible_schemes" wrapped between ---JSON_START--- and ---JSON_END---.`;

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

  // We strictly use gemini-3-pro-preview for Google Search capabilities
  if (!geminiKey) throw new Error("Gemini API Key missing in Admin settings.");

  const ai = new GoogleGenAI({ apiKey: geminiKey });
  const prompt = `SEARCH AND ANALYZE: For this user profile ${JSON.stringify(profile)}, find the latest (2024-2025) schemes from Rajasthan Govt and Central Govt.
Use Google Search to verify current eligibility rules on .gov.in websites.
Focus on: ${profile.gender === 'Female' ? 'Women empowerment,' : ''} ${profile.is_farmer === 'Yes' ? 'Agricultural subsidies,' : ''} ${profile.age < 25 ? 'Scholarships,' : ''} Social Security.
Identify the exact roadmap: Which signatures (Patwari/Sarpanch) are needed? Where to apply (e-Mitra or portal)?`;

  try {
    const res = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: { 
        systemInstruction: SYSTEM_INSTRUCTION, 
        tools: [{ googleSearch: {} }] 
      }
    });

    const rawResult = res.text || "";
    const sources = res.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const data = robustJsonParse(rawResult);
    let list = data?.eligible_schemes || (Array.isArray(data) ? data : []);

    // Sanitize
    list = list.map((s: any) => ({
      ...s,
      government: s.government || (profile.state === 'Rajasthan' ? 'Rajasthan Govt' : 'Central Govt'),
      eligibility_status: s.eligibility_status || 'ELIGIBLE',
      signatures_required: Array.isArray(s.signatures_required) ? s.signatures_required : ["आवेदक"]
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
  } catch (e: any) {
    console.error("Search failed", e);
    throw new Error(`लाइव सर्च विफल: ${e.message}`);
  }
}
