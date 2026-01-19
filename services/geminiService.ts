
import { UserProfile, AnalysisResponse, Scheme } from "../types";
import { dbService } from "./dbService";

const SYSTEM_INSTRUCTION = `आप भारत सरकार और राजस्थान सरकार की योजनाओं के विशेषज्ञ विश्लेषक हैं। 

पात्रता विश्लेषण नियम (Strict Selection Rules):
1. केवल पात्र योजनाएं (ELIGIBLE): उन योजनाओं की सूची दें जिनके लिए उपयोगकर्ता 100% पात्र है।
2. केवल 5 सशर्त योजनाएं (CONDITIONAL): ऐसी ठीक 5 योजनाएं चुनें जहाँ उपयोगकर्ता 80% शर्तें पूरी करता है, और बताएं कि बाकी 20% (जैसे कोई सर्टिफिकेट) कैसे पूरा किया जा सकता है।
3. डेटाबेस सीमा: अनावश्यक रूप से पूरी सूची न दिखाएं। केवल वे ही दिखाएं जो ऊपर दी गई शर्तों पर खरी उतरती हों।
4. प्रोफाइल मिलान: उपयोगकर्ता के 30+ मापदंडों का उपयोग करें। 
5. भाषा और प्रारूप: सारा विवरण शुद्ध हिंदी में हो। परिणाम अनिवार्य रूप से JSON ऑब्जेक्ट में 'eligible_schemes' ऐरे के साथ हो।

JSON प्रारूप में ही उत्तर दें।`;

function robustJsonParse(text: string): any {
  if (!text) return null;
  try {
    const md = text.match(/```json\s*([\s\S]*?)\s*```/i);
    if (md) {
      const parsed = JSON.parse(md[1].trim());
      return parsed.eligible_schemes || (Array.isArray(parsed) ? parsed : null);
    }
    
    const startIdx = Math.min(
      text.indexOf('{') === -1 ? Infinity : text.indexOf('{'),
      text.indexOf('[') === -1 ? Infinity : text.indexOf('[')
    );
    const endIdx = Math.max(text.lastIndexOf('}'), text.lastIndexOf(']'));
    
    if (startIdx !== Infinity && endIdx !== -1 && endIdx > startIdx) {
      const cleaned = text.substring(startIdx, endIdx + 1);
      const parsed = JSON.parse(cleaned);
      return parsed.eligible_schemes || (Array.isArray(parsed) ? parsed : null);
    }
  } catch (e) {
    console.error("Groq JSON Parse Error:", e);
  }
  return null;
}

/**
 * Fetch from Groq API as requested by the user.
 */
async function analyzeWithGroq(profile: UserProfile): Promise<AnalysisResponse> {
  const apiKey = process.env.API_KEY || "";
  
  if (!apiKey || apiKey === "") {
    throw new Error("API Key (Groq) is missing in the environment.");
  }

  const prompt = `उपयोगकर्ता प्रोफाइल डेटा: ${JSON.stringify(profile)}.
  नियम: उपयोगकर्ता के लिए जो 'ELIGIBLE' हैं वे दिखाएं और ठीक 5 ऐसी 'CONDITIONAL' योजनाएं दिखाएं जो पात्रता के करीब हों। 
  20 से ज्यादा परिणाम न दें। शुद्ध हिंदी का उपयोग करें।`;

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: SYSTEM_INSTRUCTION },
        { role: "user", content: prompt }
      ],
      temperature: 0.6,
      max_tokens: 4096,
      response_format: { type: "json_object" }
    })
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(`Groq API Status ${response.status}: ${errorBody.error?.message || response.statusText}`);
  }

  const data = await response.json();
  const raw = data.choices[0]?.message?.content || "";
  const aiSchemes = robustJsonParse(raw) || [];

  if (aiSchemes.length > 0) {
    aiSchemes.forEach((s: Scheme) => dbService.upsertScheme(s));
  }

  return {
    hindiContent: "Groq AI द्वारा विश्लेषण पूर्ण। हमने केवल वही योजनाएं चुनी हैं जिनके लिए आप पात्र हैं या थोड़े प्रयास से पात्र हो सकते हैं।",
    eligible_schemes: aiSchemes,
  };
}

export async function analyzeEligibility(profile: UserProfile, isDummy: boolean): Promise<AnalysisResponse> {
  const profileHash = btoa(unescape(encodeURIComponent(JSON.stringify(profile))));
  const cached = await dbService.getCache(profileHash);
  if (cached) return cached;

  try {
    // Rely primarily on Groq AI for dynamic eligibility determination based on profile
    const aiResult = await analyzeWithGroq(profile);
    
    const rawSchemes = aiResult.eligible_schemes || [];
    
    // Strict Filtering:
    // 1. All ELIGIBLE schemes
    // 2. Limit to exactly 5 CONDITIONAL schemes (if more exist)
    const eligible = rawSchemes.filter(s => s.eligibility_status === 'ELIGIBLE');
    const conditional = rawSchemes.filter(s => s.eligibility_status === 'CONDITIONAL').slice(0, 5);
    
    const finalSchemesList = [...eligible, ...conditional];
    
    const finalResult = { 
      ...aiResult, 
      eligible_schemes: finalSchemesList 
    };
    
    await dbService.saveCache(profileHash, finalResult);
    return finalResult;
  } catch (e) {
    console.error("AI Analysis Failed:", e);
    // On failure, only show a subset of DB schemes to prevent showing 'everything'
    const dbSchemes = await dbService.getAllSchemes();
    const filteredDb = dbSchemes.filter(s => {
      if (s.government === 'Rajasthan Govt' && profile.state !== 'Rajasthan') return false;
      const isFemaleSpecific = s.yojana_name.includes("महिला") || s.yojana_name.includes("छात्रा") || s.category?.includes("Women");
      if (isFemaleSpecific && profile.gender === 'Male') return false;
      return true;
    }).slice(0, 8); // Keep fallback list minimal

    return { 
      hindiContent: "डेटाबेस से प्राप्त सीमित परिणाम: AI सेवा वर्तमान में अनुपलब्ध है, आपकी प्रोफाइल के अनुसार मुख्य योजनाएं यहाँ हैं।", 
      eligible_schemes: filteredDb 
    };
  }
}

export async function testApiConnection(): Promise<boolean> {
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: "hi" }],
        max_tokens: 5
      })
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}
