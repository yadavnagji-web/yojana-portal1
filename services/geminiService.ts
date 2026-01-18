
import { GoogleGenAI } from "@google/genai";
import { UserProfile, AnalysisResponse, Scheme } from "../types";
import { dbService } from "./dbService";

const SYSTEM_INSTRUCTION = `You are a world-class Indian Government Welfare Scheme Analyst.
Deep expertise in Central and Rajasthan state schemes (Jan-Aadhar, Ration Card, TSP, 2-child policy).
Respond in polite Hindi (Devanagari) summary followed by a JSON array of matches.

STRICT JSON OUTPUT FORMAT:
{
  "eligible_schemes": [
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
  ]
}`;

function extractJson(text: string): any {
  try {
    const jsonMatch = text.match(/---JSON_START---([\s\S]*?)---JSON_END---/) || 
                     text.match(/```json\s*([\s\S]*?)\s*```/) ||
                     text.match(/\[\s*\{[\s\S]*\}\s*\]/) ||
                     text.match(/\{\s*"eligible_schemes"[\s\S]*\}/);
    
    if (jsonMatch) {
      const content = jsonMatch[1] || jsonMatch[0];
      return JSON.parse(content.trim());
    }
  } catch (e) {
    console.error("JSON Extraction failed:", e);
  }
  return null;
}

async function getAIClient() {
  await dbService.init();
  const dbKeys = await dbService.getSetting<any>('api_keys');
  
  const finalKey = dbKeys?.gemini?.trim() || dbKeys?.groq?.trim() || process.env.API_KEY?.trim();
  
  if (!finalKey || finalKey === "" || finalKey === "YOUR_API_KEY") {
    throw new Error("API Key missing! Kripya Admin Panel mein API Key set karein.");
  }
  
  return new GoogleGenAI({ apiKey: finalKey });
}

export async function analyzeEligibility(profile: UserProfile): Promise<AnalysisResponse> {
  const ai = await getAIClient();
  const localSchemes = await dbService.getAllSchemes();
  const dbNames = localSchemes.map(s => s.yojana_name).join(", ");

  const prompt = `Analyze eligibility for: ${JSON.stringify(profile)}. 
  Database Context: ${dbNames}.
  Output Hindi summary and JSON array inside ---JSON_START--- and ---JSON_END--- tags.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview', // Flash is 3x faster than Pro
      contents: prompt,
      config: { 
        systemInstruction: SYSTEM_INSTRUCTION, 
        tools: [{ googleSearch: {} }],
        temperature: 0.1 // Low temperature for faster deterministic response
      },
    });

    const text = response.text || "";
    const extracted = extractJson(text);
    const eligible_schemes = extracted?.eligible_schemes || (Array.isArray(extracted) ? extracted : []);

    const result = {
      hindiContent: text.split(/---JSON_START---|```json|\[/)[0].trim(),
      eligible_schemes,
      groundingSources: response.candidates?.[0]?.groundingMetadata?.groundingChunks || []
    };

    await dbService.saveAppData('last_result', result);
    return result;
  } catch (err: any) {
    const errMsg = err.message || "";
    if (errMsg.includes("429") || errMsg.includes("quota") || errMsg.includes("exhausted")) {
      throw new Error("API Limit khatam ho gayi hai (Data Exhausted)! Kripya doosri API Key use karein ya thodi der baad try karein.");
    }
    throw new Error(errMsg || "AI analysis fail ho gaya.");
  }
}

export async function fetchMasterSchemes(category: 'Central' | 'Rajasthan'): Promise<Scheme[]> {
  const ai = await getAIClient();
  const prompt = `List 15 updated ${category} welfare schemes 2024-2025. Output only JSON array.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: { systemInstruction: SYSTEM_INSTRUCTION, tools: [{ googleSearch: {} }] },
    });

    const text = response.text || "";
    const fetched = extractJson(text);
    
    if (Array.isArray(fetched)) {
      for (const s of fetched) await dbService.upsertScheme(s);
      return fetched;
    }
    throw new Error("Invalid response format.");
  } catch (err: any) {
    if (err.message.includes("429")) throw new Error("API Limit Exhausted!");
    throw err;
  }
}
