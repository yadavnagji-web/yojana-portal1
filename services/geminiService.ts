
import { UserProfile, AnalysisResponse, Scheme } from "../types";
import { dbService } from "./dbService";

/**
 * Groq API Configuration
 * Using the API key from environment to prevent GitHub secret scanning blocks.
 */
const GROQ_MODEL = "llama-3.3-70b-versatile";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

const SYSTEM_INSTRUCTION = `आप भारत सरकार और राजस्थान सरकार की योजनाओं के विशेषज्ञ विश्लेषक हैं। 

पात्रता विश्लेषण नियम (Strict Selection Rules):
1. पात्र योजनाएं (ELIGIBLE): केवल वे ही योजनाएं दें जिनके लिए उपयोगकर्ता 100% पात्र है।
2. सशर्त योजनाएं (CONDITIONAL): ऐसी ठीक 5 योजनाएं चुनें जहाँ उपयोगकर्ता 80% पात्रता पूरी करता है, और बताएं कि बाकी 20% (जैसे प्रमाण पत्र) कैसे पूरा करें।
3. प्रोफाइल मिलान: आयु, लिंग, आय, स्थान, जाति और शिक्षा का सूक्ष्म विश्लेषण करें।
4. भाषा: शुद्ध और आधिकारिक हिंदी।
5. प्रारूप: अनिवार्य रूप से 'eligible_schemes' ऐरे के साथ JSON उत्तर दें।`;

/**
 * Robust JSON extraction from LLM responses
 */
function extractSchemesFromText(text: string): Scheme[] {
  try {
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/{[\s\S]*}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed.eligible_schemes || (Array.isArray(parsed) ? parsed : []);
    }
  } catch (e) {
    console.error("JSON Parsing Error:", e);
  }
  return [];
}

export async function analyzeEligibility(profile: UserProfile, isDummy: boolean): Promise<AnalysisResponse> {
  const profileHash = btoa(unescape(encodeURIComponent(JSON.stringify(profile))));
  const cached = await dbService.getCache(profileHash);
  if (cached) return cached;

  const apiKey = process.env.API_KEY;

  if (!apiKey) {
    return {
      hindiContent: "त्रुटि: API कुंजी सेट नहीं है। कृपया Settings में Groq API Key दर्ज करें।",
      eligible_schemes: []
    };
  }

  try {
    const response = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: "system", content: SYSTEM_INSTRUCTION },
          { role: "user", content: `उपयोगकर्ता प्रोफाइल डेटा: ${JSON.stringify(profile)}. कृपया पात्रता का विश्लेषण करें।` }
        ],
        temperature: 0.2,
        response_format: { type: "json_object" }
      })
    });

    // Handle Rate Limiting / Exhaustion
    if (response.status === 429) {
      throw new Error("DATA_EXHAUSTED");
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `API Error: ${response.status}`);
    }

    const data = await response.json();
    const rawContent = data.choices[0]?.message?.content || "";
    const aiSchemes = extractSchemesFromText(rawContent);

    // Strict local filtering logic:
    // 1. All ELIGIBLE schemes
    // 2. Exactly 5 CONDITIONAL schemes
    const eligible = aiSchemes.filter(s => s.eligibility_status === 'ELIGIBLE');
    const conditional = aiSchemes.filter(s => s.eligibility_status === 'CONDITIONAL').slice(0, 5);
    
    const finalSchemes = [...eligible, ...conditional];

    // Cache discovery to local DB
    finalSchemes.forEach(s => dbService.upsertScheme(s));

    const result: AnalysisResponse = {
      hindiContent: "Groq AI (Llama 3.3) द्वारा विश्लेषण पूर्ण। हमने केवल वही योजनाएं चुनी हैं जो आपके लिए सबसे अधिक प्रासंगिक हैं।",
      eligible_schemes: finalSchemes,
      timestamp: Date.now()
    };

    await dbService.saveCache(profileHash, result);
    return result;

  } catch (e: any) {
    console.error("Groq Analysis Error:", e);
    
    if (e.message === "DATA_EXHAUSTED" || e.message.includes("rate_limit")) {
      return {
        hindiContent: "क्षमा करें, वर्तमान में 'API Data Exhausted' (डाटा सीमा समाप्त) हो गई है। कृपया कुछ समय बाद पुनः प्रयास करें या हमारे मुख्य डेटाबेस से परिणाम देखें।",
        eligible_schemes: (await dbService.getAllSchemes()).slice(0, 5)
      };
    }

    // Standard Fallback from Local DB
    const dbSchemes = await dbService.getAllSchemes();
    const filtered = dbSchemes.filter(s => {
      if (s.government === 'Rajasthan Govt' && profile.state !== 'Rajasthan') return false;
      const isFemale = s.yojana_name.includes("महिला") || s.yojana_name.includes("छात्रा");
      if (isFemale && profile.gender === 'Male') return false;
      return true;
    }).slice(0, 8);

    return {
      hindiContent: "AI सेवा अभी व्यस्त है। आपकी प्रोफाइल के आधार पर स्थानीय डेटाबेस से कुछ मुख्य योजनाएं यहाँ हैं:",
      eligible_schemes: filtered
    };
  }
}

export async function testApiConnection(): Promise<boolean> {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return false;
  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [{ role: "user", content: "hi" }],
        max_tokens: 5
      })
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}
