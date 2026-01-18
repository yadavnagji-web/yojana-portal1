
import { GoogleGenAI } from "@google/genai";
import { UserProfile, AnalysisResponse, Scheme } from "../types";
import { dbService } from "./dbService";

const SYSTEM_INSTRUCTION = `You are a World-Class Indian Government Welfare Policy Analyst.
Your task is to identify eligible schemes for a user based on their profile for the 2024-25 and 2026 cycles.

STRICT OUTPUT RULES:
1. LANGUAGE: All descriptive text MUST be in Hindi (Devanagari).
2. JSON: You must provide a JSON object with the key "eligible_schemes".
3. NO EMPTY RESULTS: If the user doesn't perfectly match any scheme, you MUST list at least 5 schemes they might be eligible for as "CONDITIONAL" (e.g., if they are a woman, show Mahila schemes; if they are a farmer, show Agri schemes).
4. ENCAPSULATION: Wrap the JSON between "---JSON_START---" and "---JSON_END---".

JSON Field Requirements:
- yojana_name: Scheme name in Hindi.
- government: "Rajasthan Govt" or "Central Govt".
- eligibility_status: "ELIGIBLE", "NOT_ELIGIBLE", or "CONDITIONAL".
- signatures_required: List who needs to sign the form (e.g. Patwari, Sarpanch).
- submission_point: Where to submit the form.`;

async function hashProfile(profile: UserProfile): Promise<string> {
  const msgUint8 = new TextEncoder().encode(JSON.stringify(profile));
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function cleanAndParseJson(text: string): any {
  if (!text) return null;
  try {
    // Strategy 1: Delimiter tags
    const taggedMatch = text.match(/---JSON_START---([\s\S]*?)---JSON_END---/);
    if (taggedMatch) return JSON.parse(taggedMatch[1].trim());

    // Strategy 2: Markdown block
    const mdMatch = text.match(/```json\s*([\s\S]*?)\s*```/i);
    if (mdMatch) return JSON.parse(mdMatch[1].trim());

    // Strategy 3: Find first '[' or '{' and last ']' or '}'
    const firstBracket = text.indexOf('[');
    const lastBracket = text.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket !== -1) {
      return JSON.parse(text.substring(firstBracket, lastBracket + 1));
    }
    
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      return JSON.parse(text.substring(firstBrace, lastBrace + 1));
    }
  } catch (e) {
    console.error("JSON Parse Logic Failed:", e);
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

  const prompt = `User Profile: ${JSON.stringify(profile)}.
Identify ALL possible Rajasthan and Central schemes for 2024-2026.
Focus on: Agriculture, Social Security, Health (Chiranjeevi/Ayushman), and Student benefits.
If the user is from Rajasthan, check specific state schemes like Anuprati, Jan Aadhar benefits, etc.
Provide a clear Hindi summary of the profile analysis and then the JSON block.`;

  let finalRawText = "";
  let groundingSources: any[] = [];

  // --- ENGINE 1: GROQ (Fast & Reliable) ---
  if (groqKey && groqKey.trim() !== "") {
    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${groqKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: SYSTEM_INSTRUCTION },
            { role: "user", content: prompt }
          ],
          temperature: 0.1
        })
      });
      const data = await response.json();
      finalRawText = data.choices?.[0]?.message?.content || "";
    } catch (e) {
      console.warn("Groq Engine Failed, falling back to Gemini...");
    }
  }

  // --- ENGINE 2: GEMINI (Primary / Fallback) ---
  if (!finalRawText && geminiKey) {
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
      finalRawText = result.text || "";
      groundingSources = result.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    } catch (e) {
      console.error("Gemini Engine Failed:", e);
    }
  }

  if (!finalRawText) {
    throw new Error("Both AI engines failed. Please verify your API Keys in the Admin panel and try again.");
  }

  const parsed = cleanAndParseJson(finalRawText);
  let schemes = parsed?.eligible_schemes || (Array.isArray(parsed) ? parsed : []);

  // Ensure schemes are formatted correctly
  schemes = schemes.map((s: any) => ({
    ...s,
    government: s.government || 'Rajasthan Govt',
    eligibility_status: s.eligibility_status || 'ELIGIBLE',
    yojana_name: s.yojana_name || 'योजना का नाम'
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
      contents: `Generate a list of 10 major ${category} schemes for India and Rajasthan for 2024-2026. Return as JSON.`,
      config: { tools: [{ googleSearch: {} }] }
    });
    const parsed = cleanAndParseJson(result.text || "");
    const list = parsed?.eligible_schemes || (Array.isArray(parsed) ? parsed : []);
    for (const s of list) { if (s.yojana_name) await dbService.upsertScheme(s); }
  } catch (e) { console.error("Sync failed:", e); }
}
