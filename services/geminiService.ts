
import { GoogleGenAI } from "@google/genai";
import { UserProfile, AnalysisResponse, Scheme } from "../types";
import { dbService } from "./dbService";

const SYSTEM_INSTRUCTION = `You are a world-class Indian Government Welfare Scheme Analyst with deep expertise in Central and State-level Sarkari Yojana.
Expertise: Rajasthan-specific systems (Jan-Aadhar, Ration Card, TSP Area), and the two-child policy (June 2002 threshold).

PRIORITY: Rajasthan Govt > Central Govt. Use database schemes as primary reference.

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

Respond in clean, polite Hindi (Devanagari) for the summary. Use clear bullet points.`;

/**
 * Robustly extracts JSON from AI response text, handling markdown blocks or raw arrays.
 */
function extractJson(text: string): any {
  try {
    // 1. Check for specific markers
    const markersMatch = text.match(/---JSON_START---([\s\S]*?)---JSON_END---/) || 
                        text.match(/```json\s*([\s\S]*?)\s*```/);
    if (markersMatch) {
      return JSON.parse(markersMatch[1].trim());
    }

    // 2. Check for anything that looks like an array [ ... ]
    const arrayMatch = text.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (arrayMatch) {
      return JSON.parse(arrayMatch[0].trim());
    }

    // 3. Check for anything that looks like an object { ... }
    const objectMatch = text.match(/\{\s*"eligible_schemes"[\s\S]*\}/);
    if (objectMatch) {
      return JSON.parse(objectMatch[0].trim());
    }
  } catch (e) {
    console.error("JSON Extraction failed:", e);
  }
  return null;
}

/**
 * Resolves API key: Box 1 (Gemini) > Box 2 (Groq) > process.env.API_KEY
 */
async function getAIClient() {
  await dbService.init();
  const dbKeys = await dbService.getSetting<any>('api_keys');
  
  const geminiKey = dbKeys?.gemini?.trim();
  const groqKey = dbKeys?.groq?.trim();
  const envKey = process.env.API_KEY?.trim();
  
  const finalKey = geminiKey || groqKey || envKey;
  
  if (!finalKey || finalKey === "" || finalKey === "YOUR_API_KEY") {
    throw new Error("API Key nahi mili! Kripya Admin Panel mein API Key darj karein aur Save karein.");
  }
  
  return new GoogleGenAI({ apiKey: finalKey });
}

export async function analyzeEligibility(profile: UserProfile): Promise<AnalysisResponse> {
  const ai = await getAIClient();
  const localSchemes = await dbService.getAllSchemes();
  const dbContext = localSchemes.map(s => s.yojana_name).join(", ");

  const prompt = `
  Analyze eligibility for the following Profile:
  ${JSON.stringify(profile)}
  
  Local Database Schemes (Primary Source): ${dbContext}

  Key Logic:
  1. Rajasthan Specific: Jan-Aadhar status is ${profile.jan_aadhar_status}. Ration Card is ${profile.ration_card_type}.
  2. TSP Area: ${profile.is_tsp_area} (District: ${profile.district}).
  3. Children: Pre-June 2002: ${profile.children_before_2002}, Post-June 2002: ${profile.children_after_2002}.
  4. Student/Farmer Specifics: ${profile.beneficiary_type === 'Student' ? `Parent status ${profile.parent_status}, Class ${profile.current_class}` : ''} ${profile.beneficiary_type === 'Farmer' ? `Land owner: ${profile.land_owner}` : ''}.

  Output Requirements:
  - Explanation in Hindi bullet points.
  - JSON array of eligible schemes inside ---JSON_START--- and ---JSON_END--- tags.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: { 
        systemInstruction: SYSTEM_INSTRUCTION, 
        tools: [{ googleSearch: {} }],
        temperature: 0.1
      },
    });

    const text = response.text || "";
    const extractedData = extractJson(text);
    
    let eligible_schemes: Scheme[] = [];
    if (extractedData) {
      eligible_schemes = Array.isArray(extractedData) ? extractedData : (extractedData.eligible_schemes || []);
    }

    const result: AnalysisResponse = {
      hindiContent: text.split(/---JSON_START---|```json|\[/)[0].trim(),
      eligible_schemes,
      groundingSources: response.candidates?.[0]?.groundingMetadata?.groundingChunks || []
    };

    await dbService.saveAppData('last_result', result);
    return result;
  } catch (err: any) {
    console.error("AI Analysis Error:", err);
    throw new Error(err.message || "AI Analysis fail ho gaya.");
  }
}

export async function fetchMasterSchemes(category: 'Central' | 'Rajasthan'): Promise<Scheme[]> {
  const ai = await getAIClient();
  const prompt = `Perform web search and list 15 updated welfare schemes for ${category} (2024-2025). Output ONLY as a JSON array.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: { systemInstruction: SYSTEM_INSTRUCTION, tools: [{ googleSearch: {} }] },
    });

    const text = response.text || "";
    const fetched = extractJson(text);
    
    if (Array.isArray(fetched)) {
      for (const s of fetched) {
        await dbService.upsertScheme(s);
      }
      return fetched;
    }
    throw new Error("Invalid format from AI.");
  } catch (err) {
    console.error("Master Fetch Error:", err);
    throw err;
  }
}
