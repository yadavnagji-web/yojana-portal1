
import { GoogleGenAI } from "@google/genai";
import { UserProfile, AnalysisResponse, Scheme } from "../types";
import { dbService } from "./dbService";

const SYSTEM_INSTRUCTION = `You are a world-class Indian Government Welfare Scheme Architect and Rajasthan Process Specialist.
Task: Evaluate eligibility for user profiles with 100% accuracy.

DATA SCOPE:
- Current active schemes (2024-25).
- Upcoming/Announced schemes for 2026.
- Central Government and Rajasthan State Government.

CRITICAL REQUIREMENTS:
1. LANGUAGE: Hindi language for all user-facing summaries, reasons, and instructions.
2. OFFICIAL FORMS: Provide EXACT application workflow based on official Rajasthan Dept/e-Mitra rules.
3. SIGNATURES: Identify precisely WHO must sign the form (e.g., Patwari, Sarpanch, Ward Member, Tehsildar, Principal, Gazetted Officer).
4. SUBMISSION: Identify precisely WHERE the form is physically or digitally submitted.

STRICT JSON OUTPUT FORMAT inside ---JSON_START--- and ---JSON_END---:
{
  "eligible_schemes": [
    {
      "yojana_name": string,
      "government": "Rajasthan Govt" | "Central Govt",
      "category": string,
      "short_purpose_hindi": string,
      "detailed_benefits": string,
      "eligibility_criteria": string[],
      "eligibility_status": "ELIGIBLE" | "NOT_ELIGIBLE" | "CONDITIONAL",
      "eligibility_reason_hindi": string,
      "required_documents": string[],
      "form_source": string,
      "application_type": "Online" | "Offline" | "Both",
      "signatures_required": string[],
      "submission_point": string,
      "official_pdf_link": string,
      "scheme_status": "NEW" | "ACTIVE" | "UPCOMING_2026"
    }
  ]
}`;

async function hashProfile(profile: UserProfile): Promise<string> {
  const msgUint8 = new TextEncoder().encode(JSON.stringify(profile));
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function extractJson(text: string): any {
  try {
    const match = text.match(/---JSON_START---([\s\S]*?)---JSON_END---/) || text.match(/```json\s*([\s\S]*?)\s*```/);
    if (match) return JSON.parse(match[1].trim());
    const arrayMatch = text.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (arrayMatch) return JSON.parse(arrayMatch[0].trim());
  } catch (e) { console.error("JSON Error", e); }
  return null;
}

export async function analyzeEligibility(profile: UserProfile, isDummy: boolean): Promise<AnalysisResponse> {
  const profileHash = await hashProfile(profile);
  
  // 1. Database-First: Check Cache
  if (!isDummy) {
    const cached = await dbService.getCache(profileHash);
    if (cached) return { ...cached, cached: true };
  }

  // 2. Resolve API Keys
  const savedKeys = await dbService.getSetting<any>('api_keys');
  const geminiKey = savedKeys?.gemini || process.env.API_KEY;
  const groqKey = savedKeys?.groq;

  let text = "";
  let groundingSources: any[] = [];
  
  // Refined prompt for 2024-25 and 2026 data
  const prompt = `Perform a deep eligibility analysis for this user profile: ${JSON.stringify(profile)}.
Use Google Search to find the latest 2024-25 active schemes and upcoming 2026 schemes/announcements from Rajasthan Government (e-Mitra, Jan-Aadhar) and Central Government.
Include specific details on required signatures (Patwari, Sarpanch, etc.) and exact submission points.`;

  // Try Groq first for reasoning if key exists
  if (groqKey && groqKey.startsWith('gsk_')) {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'system', content: SYSTEM_INSTRUCTION }, { role: 'user', content: prompt }],
          temperature: 0.1
        })
      });
      const data = await response.json();
      if (data.choices?.[0]?.message?.content) {
        text = data.choices[0].message.content;
      }
    } catch (e) { console.error("Groq Fail", e); }
  }

  // Fallback or Dual Fetch: Gemini 3 Pro with Search Grounding
  if (geminiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey: geminiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: { 
          systemInstruction: SYSTEM_INSTRUCTION, 
          tools: [{ googleSearch: {} }] 
        }
      });
      
      // If we already got text from Groq, we can merge or use Gemini as primary for Grounding accuracy
      const geminiText = response.text || "";
      const geminiGrounding = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      
      // Prefer Gemini if Groq failed or for Search accuracy
      if (!text || geminiGrounding.length > 0) {
        text = geminiText;
        groundingSources = geminiGrounding;
      }
    } catch (e) {
      console.error("Gemini Fail", e);
      if (!text) throw new Error("AI Processing Failed. Please check API keys in Admin.");
    }
  }

  const extracted = extractJson(text);
  let schemes = extracted?.eligible_schemes || (Array.isArray(extracted) ? extracted : []);

  const result: AnalysisResponse = {
    hindiContent: text.split(/---JSON_START---|```json|\[/)[0].trim(),
    eligible_schemes: schemes,
    groundingSources,
    timestamp: Date.now()
  };

  // 3. Save to DB if NOT dummy
  if (!isDummy) {
    await dbService.saveCache(profileHash, result);
    await dbService.saveUserSubmission(profile);
  }

  return result;
}

export async function fetchMasterSchemes(category: string) {
  const savedKeys = await dbService.getSetting<any>('api_keys');
  const key = savedKeys?.gemini || process.env.API_KEY;
  if (!key) return;

  const ai = new GoogleGenAI({ apiKey: key });
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `List 15 major ${category} government schemes for 2024-25 and upcoming 2026 policies. 
Return strictly as JSON with full application workflow including signature requirements and submission points.`,
    config: { tools: [{ googleSearch: {} }] }
  });
  
  const fetched = extractJson(response.text || "");
  const schemes = fetched?.eligible_schemes || (Array.isArray(fetched) ? fetched : []);
  for (const s of schemes) {
    if (s.yojana_name) await dbService.upsertScheme(s);
  }
}
