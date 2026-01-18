
import { GoogleGenAI } from "@google/genai";
import { UserProfile, AnalysisResponse, Scheme } from "../types";
import { dbService } from "./dbService";

const SYSTEM_INSTRUCTION = `You are an Expert Government Policy Analyst. Identify ELIGIBLE welfare schemes for a user in Hindi.
SOURCES: Rajasthan Government & Government of India official portals.

STRICT GUIDELINES:
1. ACCURACY: Only return matches based on user profile.
2. LANGUAGE: All output MUST be in Hindi (Devanagari).
3. MANDATORY FIELDS: yojana_name, government, detailed_benefits, eligibility_reason_hindi, required_documents, form_source, application_type, signatures_required, submission_point, official_pdf_link.
4. OUTPUT: Return a JSON object with key "eligible_schemes" wrapped between ---JSON_START--- and ---JSON_END---.`;

export async function testApiConnection(provider: 'gemini' | 'groq', key: string): Promise<boolean> {
  if (!key) return false;
  try {
    if (provider === 'gemini') {
      const ai = new GoogleGenAI({ apiKey: key });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: 'test',
      });
      return !!response.text;
    } else {
      const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "user", content: "hi" }],
          max_tokens: 5
        })
      });
      return resp.ok;
    }
  } catch (e) {
    return false;
  }
}

function robustJsonParse(text: string): any {
  if (!text) return null;
  try {
    const tagged = text.match(/---JSON_START---([\s\S]*?)---JSON_END---/);
    if (tagged) return JSON.parse(tagged[1].trim());
    const md = text.match(/```json\s*([\s\S]*?)\s*```/i);
    if (md) return JSON.parse(md[1].trim());
    const startIdx = Math.max(text.indexOf('['), text.indexOf('{'));
    const endIdx = Math.max(text.lastIndexOf(']'), text.lastIndexOf('}'));
    if (startIdx !== -1 && endIdx !== -1) return JSON.parse(text.substring(startIdx, endIdx + 1));
  } catch (e) {}
  return null;
}

async function analyzeWithGemini(profile: UserProfile, key: string): Promise<AnalysisResponse> {
  const ai = new GoogleGenAI({ apiKey: key });
  const prompt = `Find active 2024-25 schemes for: ${JSON.stringify(profile)}. Provide step-by-step roadmap.`;
  const res = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: prompt,
    config: { systemInstruction: SYSTEM_INSTRUCTION, tools: [{ googleSearch: {} }] }
  });
  const raw = res.text || "";
  const data = robustJsonParse(raw);
  return {
    hindiContent: raw.split(/---JSON_START---|\[/)[0].trim(),
    eligible_schemes: data?.eligible_schemes || (Array.isArray(data) ? data : []),
    groundingSources: res.candidates?.[0]?.groundingMetadata?.groundingChunks || []
  };
}

async function analyzeWithGroq(profile: UserProfile, key: string): Promise<AnalysisResponse> {
  const prompt = `${SYSTEM_INSTRUCTION}\n\nUSER PROFILE: ${JSON.stringify(profile)}\n\nFind eligible schemes and return JSON.`;
  const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2
    })
  });
  if (!resp.ok) throw new Error("Groq API failed");
  const result = await resp.json();
  const raw = result.choices[0].message.content;
  const data = robustJsonParse(raw);
  return {
    hindiContent: raw.split(/---JSON_START---|\[/)[0].trim() + "\n\n(Processed via Groq Backup AI)",
    eligible_schemes: data?.eligible_schemes || (Array.isArray(data) ? data : []),
  };
}

export async function analyzeEligibility(profile: UserProfile, isDummy: boolean): Promise<AnalysisResponse> {
  const savedKeys = await dbService.getSetting<any>('api_keys');
  const geminiKey = savedKeys?.gemini || process.env.API_KEY;
  const groqKey = savedKeys?.groq;

  // Try Gemini First (Better search)
  if (geminiKey) {
    try {
      console.log("Trying Gemini...");
      return await analyzeWithGemini(profile, geminiKey);
    } catch (e) {
      console.warn("Gemini Failed, attempting Groq fallback...", e);
      if (groqKey) return await analyzeWithGroq(profile, groqKey);
      throw e;
    }
  } 
  
  // If no Gemini, use Groq
  if (groqKey) {
    console.log("Using Groq directly...");
    return await analyzeWithGroq(profile, groqKey);
  }

  throw new Error("No valid API Key found. Please add keys in Admin.");
}
