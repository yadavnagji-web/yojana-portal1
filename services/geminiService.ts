
import { GoogleGenAI } from "@google/genai";
import { UserProfile, AnalysisResponse, Scheme } from "../types";
import { dbService } from "./dbService";

const SYSTEM_INSTRUCTION = `You are the Lead Welfare Architect for the Government of India and Rajasthan. 
Your task is to analyze user eligibility for schemes in the 2024-25 and 2026 cycles.

STRICT INSTRUCTIONS:
1. RESPONSE LANGUAGE: Hindi (Devanagari script).
2. ACCURACY: Use the user's Age, Income, Category, and Profession as hard filters.
3. SIGNATURES: Specify if Patwari, Tehsildar, or Sarpanch signature is needed.
4. JSON FORMAT: You MUST wrap the JSON array inside ---JSON_START--- and ---JSON_END---.

REQUIRED JSON FIELDS:
- yojana_name: String
- government: "Rajasthan Govt" or "Central Govt"
- category: String
- eligibility_status: "ELIGIBLE" | "NOT_ELIGIBLE" | "CONDITIONAL"
- eligibility_reason_hindi: String
- signatures_required: Array of strings
- submission_point: String
- official_pdf_link: String`;

async function hashProfile(profile: UserProfile): Promise<string> {
  const msgUint8 = new TextEncoder().encode(JSON.stringify(profile));
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function extractJson(text: string): any {
  if (!text) return null;
  try {
    // Try to find custom tags first
    const customMatch = text.match(/---JSON_START---([\s\S]*?)---JSON_END---/);
    if (customMatch) return JSON.parse(customMatch[1].trim());

    // Fallback to markdown code blocks
    const codeMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/```\s*([\s\S]*?)\s*```/);
    if (codeMatch) return JSON.parse(codeMatch[1].trim());

    // Fallback to finding raw array/object
    const arrayMatch = text.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (arrayMatch) return JSON.parse(arrayMatch[0].trim());

    const objectMatch = text.match(/\{\s*"eligible_schemes"[\s\S]*\}/);
    if (objectMatch) return JSON.parse(objectMatch[0].trim());
  } catch (e) {
    console.error("Critical JSON Parse Error:", e, "Raw Text sample:", text.substring(0, 100));
  }
  return null;
}

export async function analyzeEligibility(profile: UserProfile, isDummy: boolean): Promise<AnalysisResponse> {
  const profileHash = await hashProfile(profile);
  
  // 1. Check DB Cache
  if (!isDummy) {
    const cached = await dbService.getCache(profileHash);
    if (cached) return { ...cached, cached: true };
  }

  const savedKeys = await dbService.getSetting<any>('api_keys');
  const geminiKey = savedKeys?.gemini || process.env.API_KEY;
  const groqKey = savedKeys?.groq;

  let apiResponseText = "";
  let groundingSources: any[] = [];

  const prompt = `User Profile: ${JSON.stringify(profile)}. 
Identify all applicable Rajasthan and Central Govt schemes for 2024-25 and upcoming 2026.
Explain exactly WHY the user is eligible or not in Hindi. 
List mandatory documents, signature requirements (Patwari/Tehsildar), and submission points.
Provide a Hindi summary of findings first, then the JSON block.`;

  // --- ATTEMPT 1: GROQ ---
  if (groqKey && groqKey.startsWith('gsk_')) {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${groqKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: SYSTEM_INSTRUCTION },
            { role: 'user', content: prompt }
          ],
          temperature: 0.2
        })
      });
      const data = await response.json();
      if (data.choices?.[0]?.message?.content) {
        apiResponseText = data.choices[0].message.content;
      }
    } catch (e) {
      console.error("Groq API Error:", e);
    }
  }

  // --- ATTEMPT 2: GEMINI 3 PRO (Primary Grounding Engine) ---
  if (!apiResponseText && geminiKey) {
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
      apiResponseText = result.text || "";
      groundingSources = result.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    } catch (e) {
      console.error("Gemini API Error:", e);
    }
  }

  if (!apiResponseText) {
    throw new Error("Result fetching failed. Please check your API Keys in the Admin Panel.");
  }

  const parsed = extractJson(apiResponseText);
  let schemes: Scheme[] = [];

  if (Array.isArray(parsed)) {
    schemes = parsed;
  } else if (parsed?.eligible_schemes) {
    schemes = parsed.eligible_schemes;
  }

  // Final validation and cleaning
  schemes = schemes.filter(s => !!s.yojana_name).map(s => ({
    ...s,
    eligibility_status: s.eligibility_status || 'ELIGIBLE',
    government: s.government || 'Rajasthan Govt'
  }));

  const finalResponse: AnalysisResponse = {
    hindiContent: apiResponseText.split(/---JSON_START---|```json|\[/)[0].trim(),
    eligible_schemes: schemes,
    groundingSources,
    timestamp: Date.now()
  };

  if (!isDummy && schemes.length > 0) {
    await dbService.saveCache(profileHash, finalResponse);
    await dbService.saveUserSubmission(profile);
  }

  return finalResponse;
}

export async function fetchMasterSchemes(category: string) {
  const savedKeys = await dbService.getSetting<any>('api_keys');
  const key = savedKeys?.gemini || process.env.API_KEY;
  if (!key) return;

  try {
    const ai = new GoogleGenAI({ apiKey: key });
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `List 15 major ${category} schemes for 2024-25 and 2026. Use strict JSON format.`,
      config: { tools: [{ googleSearch: {} }] }
    });
    
    const fetched = extractJson(response.text || "");
    const schemes = fetched?.eligible_schemes || (Array.isArray(fetched) ? fetched : []);
    for (const s of schemes) {
      if (s.yojana_name) await dbService.upsertScheme(s);
    }
  } catch (e) {
    console.error("Master Sync Error:", e);
  }
}
