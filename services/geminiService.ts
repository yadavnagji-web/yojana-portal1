
import { GoogleGenAI } from "@google/genai";
import { UserProfile, AnalysisResponse, Scheme } from "../types";
import { dbService } from "./dbService";

const SYSTEM_INSTRUCTION = `You are an Expert Government Policy Analyst specializing in Live Search and Eligibility Verification.
Your task is to identify ELIGIBLE welfare schemes for a user by searching OFFICIAL GOVERNMENT WEBSITES ONLY.

SOURCES: 
- Rajasthan Government (rajasthan.gov.in, sso.rajasthan.gov.in, dipr.rajasthan.gov.in)
- Government of India (india.gov.in, myscheme.gov.in, pib.gov.in)

STRICT OPERATIONAL GUIDELINES:
1. NO PRE-FED DATA: Do not use hardcoded lists. Use 'googleSearch' tool for every query to find 2024-2025 and 2026 active schemes.
2. ACCURACY: Only return schemes where the user profile realistically matches the criteria.
3. LANGUAGE: All output text (names, descriptions, reasons) MUST be in Hindi (Devanagari).
4. MANDATORY SCHEME FIELDS:
   - yojana_name: Official name in Hindi.
   - government: "Rajasthan Govt" or "Central Govt".
   - detailed_benefits: Financial/Social benefits in detail.
   - eligibility_reason_hindi: Why this specific user matches.
   - required_documents: Actual documents list.
   - form_source: URL or Portal name.
   - application_type: Online/Offline/Both.
   - signatures_required: List (e.g., Patwari, Sarpanch, Tehsildar).
   - submission_point: Physical or Digital location.
   - official_pdf_link: Link to official guidelines or portal.

5. OUTPUT FORMAT: Return a JSON object with the key "eligible_schemes" wrapped between ---JSON_START--- and ---JSON_END---.`;

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
        headers: { 
          "Authorization": `Bearer ${key}`, 
          "Content-Type": "application/json" 
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "user", content: "hi" }],
          max_tokens: 5
        })
      });
      return resp.ok;
    }
  } catch (e) {
    console.error(`Connection test failed for ${provider}:`, e);
    return false;
  }
}

async function hashProfile(profile: UserProfile): Promise<string> {
  const msgUint8 = new TextEncoder().encode(JSON.stringify(profile));
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function robustJsonParse(text: string): any {
  if (!text) return null;
  try {
    const tagged = text.match(/---JSON_START---([\s\S]*?)---JSON_END---/);
    if (tagged) return JSON.parse(tagged[1].trim());
    const md = text.match(/```json\s*([\s\S]*?)\s*```/i);
    if (md) return JSON.parse(md[1].trim());
    const startIdx = Math.min(
      text.indexOf('[') === -1 ? Infinity : text.indexOf('['),
      text.indexOf('{') === -1 ? Infinity : text.indexOf('{')
    );
    const endIdx = Math.max(text.lastIndexOf(']'), text.lastIndexOf('}'));
    if (startIdx !== Infinity && endIdx !== -1) {
      return JSON.parse(text.substring(startIdx, endIdx + 1));
    }
  } catch (e) {
    console.error("JSON Parsing failed", e);
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

  if (!geminiKey) throw new Error("Gemini API Key missing. Please check Admin settings.");

  const ai = new GoogleGenAI({ apiKey: geminiKey });
  const searchPrompt = `Search official Rajasthan and Indian Govt sites (2024-2025) for active welfare schemes for this profile: ${JSON.stringify(profile)}.
Return results as JSON with a step-by-step roadmap including needed signatures (Patwari, etc.) and where to submit.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: searchPrompt,
      config: { 
        systemInstruction: SYSTEM_INSTRUCTION, 
        tools: [{ googleSearch: {} }] 
      }
    });

    const geminiRaw = response.text || "";
    const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    let data = robustJsonParse(geminiRaw);
    let list: Scheme[] = data?.eligible_schemes || (Array.isArray(data) ? data : []);

    let verificationContent = "";

    if (groqKey && list.length > 0) {
      try {
        const verifyPrompt = `Verify these schemes for this user:
Profile: ${JSON.stringify(profile)}
Schemes: ${JSON.stringify(list)}
Provide a short Hindi audit confirming eligibility.`;
        
        const groqResp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { "Authorization": `Bearer ${groqKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [{ role: "user", content: verifyPrompt }],
            temperature: 0.1
          })
        });
        const groqData = await groqResp.json();
        verificationContent = groqData.choices?.[0]?.message?.content || "";
      } catch (ge) {
        console.warn("Groq audit failed, skipping...", ge);
      }
    }

    const finalResponse: AnalysisResponse = {
      hindiContent: geminiRaw.split(/---JSON_START---|```json|\[/)[0].trim() + 
                    (verificationContent ? `\n\n--- DUAL AI AUDIT ---\n${verificationContent}` : ""),
      eligible_schemes: list.map(s => ({
        ...s,
        government: s.government || (profile.state === 'Rajasthan' ? 'Rajasthan Govt' : 'Central Govt'),
        eligibility_status: s.eligibility_status || 'ELIGIBLE',
      })),
      groundingSources: sources,
      timestamp: Date.now()
    };

    if (!isDummy && list.length > 0) {
      await dbService.saveCache(profileHash, finalResponse);
      await dbService.saveUserSubmission(profile);
    }
    return finalResponse;
  } catch (e: any) {
    console.error("Critical API Error:", e);
    throw new Error(`API Error: ${e.message || "Unknown error occurred"}`);
  }
}
