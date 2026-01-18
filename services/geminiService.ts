
import { GoogleGenAI } from "@google/genai";
import { UserProfile, AnalysisResponse, Scheme } from "../types";
import { dbService } from "./dbService";

const SYSTEM_INSTRUCTION = `You are an expert Indian Government Welfare Scheme Analyst.
Analyze user profiles against Central and Rajasthan state schemes.
PRIORITY: Rajasthan Govt > Central Govt. Focus on TSP/Tribal areas for Rajasthan.

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

Respond in simple Hindi for the content part. Use bullet points.`;

async function getAIClient() {
  // Check browser-level database first
  const dbKeys = await dbService.getSetting<{ gemini: string }>('api_keys');
  const apiKey = dbKeys?.gemini || process.env.API_KEY;
  
  if (!apiKey || apiKey.trim() === "") {
    throw new Error("API Key set nahi hai. Kripya Admin Panel mein API Key darj karein.");
  }
  return new GoogleGenAI({ apiKey });
}

export async function fetchMasterSchemes(category: 'Central' | 'Rajasthan'): Promise<Scheme[]> {
  const ai = await getAIClient();
  const prompt = `2024-2025 ki pramukh ${category} sarkari yojanaon ki list nikaalein. Output only JSON array.`;

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

export async function analyzeEligibility(profile: UserProfile): Promise<AnalysisResponse> {
  const ai = await getAIClient();
  const localSchemes = await dbService.getAllSchemes();
  const context = localSchemes.map(s => s.yojana_name).join(", ");

  const prompt = `
  Analyze eligibility for: ${JSON.stringify(profile)}
  Context: ${context}
  
  User Specifics:
  - Jan-Aadhar: ${profile.jan_aadhar_status}
  - Ration Card: ${profile.ration_card_type}
  - Pension: ${profile.pension_status}
  - Children: ${profile.children_before_2002} (Pre-2002), ${profile.children_after_2002} (Post-2002)
  - Student Status: ${profile.parent_status} / ${profile.current_class}
  
  Find matched schemes. Return format:
  ---JSON_START---
  { "eligible_schemes": [...] }
  ---JSON_END---
  Summary in Hindi before JSON.`;

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
        console.error("JSON Parse Error", e);
      }
    }

    return {
      hindiContent: text.split("---JSON_START---")[0].trim(),
      eligible_schemes,
      groundingSources: response.candidates?.[0]?.groundingMetadata?.groundingChunks || []
    };
  } catch (err) {
    console.error("Analysis Error:", err);
    throw err;
  }
}

export async function proposeSystemImprovement(): Promise<string> {
  const ai = await getAIClient();
  const prompt = `System improvements for Welfare AI. Analyze logic and suggest one optimization with code.`;
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: { systemInstruction: SYSTEM_INSTRUCTION },
  });
  return response.text || "No proposal.";
}
