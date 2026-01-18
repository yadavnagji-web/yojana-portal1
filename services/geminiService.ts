
import { GoogleGenAI } from "@google/genai";
import { UserProfile, AnalysisResponse, Scheme } from "../types";
import { dbService } from "./dbService";

const SYSTEM_INSTRUCTION = `You are a world-class Indian Government Welfare Scheme Analyst.
Deep expertise in Central Govt and Rajasthan State Sarkari Yojana (e.g., Jan-Aadhar, Chiranjeevi, Annuity schemes).
PRIORITY: Rajasthan Govt > Central Govt. Focus on TSP districts when applicable.

STRICT JSON OUTPUT FORMAT FOR SCHEMES:
{
  "yojana_name": string,
  "government": "Rajasthan Govt" | "Central Govt",
  "applicable_area": string,
  "beneficiary_type": string[],
  "caste_category": string[],
  "short_purpose_hindi": string,
  "detailed_benefits": string,
  "eligibility": string[],
  "required_documents": string[],
  "application_process_steps": string[],
  "online_apply_link": string,
  "offline_process": string,
  "official_pdf_link": string,
  "scheme_status": "NEW" | "UPDATED" | "ACTIVE" | "EXPIRED"
}

Respond in clean, polite Hindi (Devanagari) for explanations. Use clear bullet points.`;

async function getAIClient() {
  // Check browser-level database first
  const dbKeys = await dbService.getSetting<{ gemini: string; groq: string }>('api_keys');
  
  // Logic: Use Box 1 (Gemini), if empty use Box 2 (Groq), if empty use Env
  const apiKey = dbKeys?.gemini?.trim() || dbKeys?.groq?.trim() || process.env.API_KEY;
  
  if (!apiKey || apiKey === "") {
    throw new Error("API Key nahi mili! Kripya Admin Panel mein kam se kam ek API Key (Gemini ya Groq box mein) darj karein.");
  }
  return new GoogleGenAI({ apiKey });
}

export async function analyzeEligibility(profile: UserProfile): Promise<AnalysisResponse> {
  const ai = await getAIClient();
  const localSchemes = await dbService.getAllSchemes();
  const dbContext = localSchemes.map(s => s.yojana_name).join(", ");

  const prompt = `
  Analyze eligibility for the following Profile:
  ${JSON.stringify(profile)}
  
  Cached Database Schemes (Primary Reference):
  ${dbContext}

  Key Logic to use:
  1. Gender: ${profile.gender}. If Male, exclude specific women schemes.
  2. Age: ${profile.age}. 
  3. Rajasthan Specific: Jan-Aadhar status is ${profile.jan_aadhar_status}. Ration Card is ${profile.ration_card_type}.
  4. Children Logic (Rajasthan): Before June 2002: ${profile.children_before_2002}, After June 2002: ${profile.children_after_2002}.
  5. TSP District: ${profile.district} (TSP Status: ${profile.is_tsp_area}).
  6. Student: ${profile.beneficiary_type === 'Student' ? `Parent Status: ${profile.parent_status}, Class: ${profile.current_class}` : 'N/A'}.
  7. Farmer: ${profile.beneficiary_type === 'Farmer' ? `Land Owner: ${profile.land_owner}` : 'N/A'}.

  Find ALL matches. Return format:
  Summary in Hindi explanation first.
  Then:
  ---JSON_START---
  { "eligible_schemes": [...] }
  ---JSON_END---`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: { systemInstruction: SYSTEM_INSTRUCTION, tools: [{ googleSearch: {} }] },
    });

    const text = response.text || "";
    const jsonMatch = text.match(/---JSON_START---([\s\S]*?)---JSON_END---/);
    let eligible_schemes: Scheme[] = [];
    
    if (jsonMatch) {
      try {
        const data = JSON.parse(jsonMatch[1]);
        eligible_schemes = data.eligible_schemes || [];
      } catch (e) {
        console.error("JSON Error", e);
      }
    }

    const result = {
      hindiContent: text.split("---JSON_START---")[0].trim(),
      eligible_schemes,
      groundingSources: response.candidates?.[0]?.groundingMetadata?.groundingChunks || []
    };

    // Auto-save results to database
    await dbService.saveAppData('last_result', result);
    return result;
  } catch (err) {
    console.error("Analysis Error:", err);
    throw err;
  }
}

export async function fetchMasterSchemes(category: 'Central' | 'Rajasthan'): Promise<Scheme[]> {
  const ai = await getAIClient();
  const prompt = `Fetch the most updated list of 2024-2025 ${category} government schemes for beneficiaries like students, farmers, widows, and BPL families. Return only JSON array.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: { systemInstruction: SYSTEM_INSTRUCTION, tools: [{ googleSearch: {} }] },
    });

    const text = response.text || "";
    const match = text.match(/\[[\s\S]*\]/);
    if (match) {
      const fetched: Scheme[] = JSON.parse(match[0]);
      for (const s of fetched) {
        await dbService.upsertScheme(s);
      }
      return fetched;
    }
  } catch (err) {
    console.error("Fetch Error:", err);
    throw err;
  }
  return await dbService.getAllSchemes();
}

export async function proposeSystemImprovement(): Promise<string> {
  const ai = await getAIClient();
  const prompt = `Suggest a coding improvement for this Indian Government Scheme portal. Provide explanation and code.`;
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: { systemInstruction: SYSTEM_INSTRUCTION },
  });
  return response.text || "";
}
