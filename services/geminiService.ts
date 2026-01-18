
import { GoogleGenAI } from "@google/genai";
import { UserProfile, AnalysisResponse, Scheme } from "../types";
import { dbService } from "./dbService";

const SYSTEM_INSTRUCTION = `You are a FULL-STACK GOVERNMENT WELFARE PLATFORM AI.
You act as 5 AI AGENTS simultaneously:
1. DATA EXTRACTION: Fetch verified data from govt portals (Jan Soochna, MyScheme).
2. ELIGIBILITY LINKING: If a user matches one condition, link all other relevant schemes.
3. CHANGE DETECTION: Compare scheme updates accurately.
4. LANGUAGE SIMPLIFICATION: Use bullet points and simple Hindi.
5. AI CODING: Propose logic improvements.

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

PRIORITY: Rajasthan Govt > Central Govt. Focus on TSP/Tribal areas for Rajasthan.
NEVER duplicate schemes. Use simple Hindi bullet points.`;

async function getAIClient(customKey?: string) {
  const dbKeys = await dbService.getSetting<{ gemini: string }>('api_keys');
  const apiKey = customKey || dbKeys?.gemini || process.env.API_KEY;
  if (!apiKey) throw new Error("API Key not found. Please set it in Admin Panel.");
  return new GoogleGenAI({ apiKey });
}

export async function fetchMasterSchemes(category: 'Central' | 'Rajasthan', forceRefresh = false): Promise<Scheme[]> {
  const ai = await getAIClient();
  const prompt = `Perform DATA EXTRACTION for 20 verified ${category} government schemes (2024-2025). 
  Include: Rajasthan TSP/Tribal Area specific schemes. 
  Output ONLY a raw JSON array of objects following the STRICT JSON format.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: { systemInstruction: SYSTEM_INSTRUCTION, tools: [{ googleSearch: {} }] },
    });

    const match = response.text.match(/\[[\s\S]*\]/);
    if (match) {
      const fetched: Scheme[] = JSON.parse(match[0]);
      for (const s of fetched) {
        await dbService.upsertScheme(s);
      }
      return fetched;
    }
  } catch (err) {
    console.error("Agent 1 Extraction Error:", err);
    throw err;
  }
  return await dbService.getAllSchemes();
}

export async function analyzeEligibility(profile: UserProfile): Promise<AnalysisResponse> {
  const ai = await getAIClient();
  const localSchemes = await dbService.getAllSchemes();
  const context = localSchemes.map(s => s.yojana_name).join(", ");

  const prompt = `
  AGENT 2 & 4: Analyze eligibility for user:
  Profile: ${JSON.stringify(profile)}
  Cached context: ${context}
  
  1. Identify ALL eligible schemes (Rajasthan & Central).
  2. For matched conditions (e.g. Widow, ST, TSP), link ALL shared schemes.
  3. Simplify output into Hindi bullet points.
  
  Return format:
  ---JSON_START---
  { "eligible_schemes": [...Strict JSON objects...] }
  ---JSON_END---
  
  Intro Content: Hindi summary explaining WHY user is eligible.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: { systemInstruction: SYSTEM_INSTRUCTION, tools: [{ googleSearch: {} }] },
    });

    const text = response.text;
    const jsonMatch = text.match(/---JSON_START---([\s\S]*?)---JSON_END---/);
    let eligible_schemes: Scheme[] = [];
    
    if (jsonMatch) {
      try {
        const data = JSON.parse(jsonMatch[1]);
        eligible_schemes = data.eligible_schemes || [];
      } catch (e) {
        console.error("JSON Parse Error inside tags", e);
      }
    }

    return {
      hindiContent: text.split("---JSON_START---")[0].trim(),
      eligible_schemes,
      groundingSources: response.candidates?.[0]?.groundingMetadata?.groundingChunks || []
    };
  } catch (err) {
    console.error("Eligibility Analysis Error:", err);
    throw err;
  }
}

export async function proposeSystemImprovement(): Promise<string> {
  const ai = await getAIClient();
  const prompt = `AGENT 5 (CODING): Analyze current platform behavior for Indian Welfare Schemes. Suggest ONE logic optimization or schema update. 
  Provide your response in clear sections:
  1. EXPLANATION: What needs to be improved.
  2. CODE DIFF: The suggested code changes.
  3. ROLLBACK PLAN: How to revert if it fails.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: { systemInstruction: SYSTEM_INSTRUCTION },
    });
    return response.text;
  } catch (err) {
    console.error("Agent 5 Error:", err);
    return "Error generating improvement proposal.";
  }
}
