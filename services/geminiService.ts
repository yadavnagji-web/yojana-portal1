
import { GoogleGenAI } from "@google/genai";
import { UserProfile, AnalysisResponse, Scheme } from "../types";
import { dbService } from "./dbService";

const SYSTEM_INSTRUCTION = `You are a world-class Indian Government Welfare Scheme Analyst. 
Analyze eligibility for Central and Rajasthan state schemes. 
Respond in polite Hindi summary followed by a JSON array of matches.

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

/**
 * Gets the active key and provider type
 */
async function getActiveKey() {
  await dbService.init();
  const dbKeys = await dbService.getSetting<any>('api_keys');
  
  const geminiKey = dbKeys?.gemini?.trim();
  const groqKey = dbKeys?.groq?.trim();
  const envKey = process.env.API_KEY?.trim();
  
  const finalKey = geminiKey || groqKey || envKey;
  
  if (!finalKey || finalKey === "" || finalKey === "YOUR_API_KEY") {
    throw new Error("API Key missing! Kripya Admin Panel mein API Key set karein.");
  }

  // Detect Provider
  const isGroq = finalKey.startsWith('gsk_');
  return { key: finalKey, isGroq };
}

/**
 * Unified request handler for both Gemini and Groq
 */
async function callAI(prompt: string, useSearch = false) {
  const { key, isGroq } = await getActiveKey();

  if (isGroq) {
    // Groq API Call (OpenAI compatible)
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: SYSTEM_INSTRUCTION },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1
      })
    });

    if (!response.ok) {
      const error = await response.json();
      if (response.status === 429) throw new Error("Groq API Limit Exhausted!");
      if (response.status === 401 || response.status === 400) throw new Error("Invalid Groq API Key! Please check your key in Admin panel.");
      throw new Error(error?.error?.message || "Groq API Error");
    }

    const data = await response.json();
    return { text: data.choices[0].message.content, groundingSources: [] };
  } else {
    // Gemini SDK Call
    const ai = new GoogleGenAI({ apiKey: key });
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: { 
          systemInstruction: SYSTEM_INSTRUCTION, 
          tools: useSearch ? [{ googleSearch: {} }] : [],
          temperature: 0.1 
        },
      });

      return { 
        text: response.text || "", 
        groundingSources: response.candidates?.[0]?.groundingMetadata?.groundingChunks || [] 
      };
    } catch (err: any) {
      const errMsg = err.message || "";
      if (errMsg.includes("429") || errMsg.includes("quota")) throw new Error("Gemini API Limit Exhausted!");
      if (errMsg.includes("400")) throw new Error("Invalid Gemini API Key! Please check your key in Admin panel.");
      throw err;
    }
  }
}

export async function analyzeEligibility(profile: UserProfile): Promise<AnalysisResponse> {
  const localSchemes = await dbService.getAllSchemes();
  const dbNames = localSchemes.map(s => s.yojana_name).join(", ");

  const prompt = `Analyze eligibility for: ${JSON.stringify(profile)}. 
  Database Context (Previously fetched): ${dbNames}.
  Output Hindi summary and JSON array inside ---JSON_START--- and ---JSON_END--- tags.`;

  try {
    const { text, groundingSources } = await callAI(prompt, true);
    const extracted = extractJson(text);
    const eligible_schemes = extracted?.eligible_schemes || (Array.isArray(extracted) ? extracted : []);

    const result = {
      hindiContent: text.split(/---JSON_START---|```json|\[/)[0].trim(),
      eligible_schemes,
      groundingSources: groundingSources
    };

    await dbService.saveAppData('last_result', result);
    return result;
  } catch (err: any) {
    throw new Error(err.message || "AI analysis fail ho gaya.");
  }
}

export async function fetchMasterSchemes(category: 'Central' | 'Rajasthan'): Promise<Scheme[]> {
  const prompt = `List 15 updated ${category} welfare schemes 2024-2025. Output only JSON array.`;

  try {
    const { text } = await callAI(prompt, true);
    const fetched = extractJson(text);
    
    if (Array.isArray(fetched)) {
      for (const s of fetched) await dbService.upsertScheme(s);
      return fetched;
    }
    throw new Error("Invalid response format.");
  } catch (err: any) {
    throw err;
  }
}
