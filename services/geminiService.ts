
import { GoogleGenAI, Type } from "@google/genai";
import { UserProfile, AnalysisResponse, Scheme } from "../types";
import { dbService } from "./dbService";

const SYSTEM_INSTRUCTION = `आप भारत सरकार और राजस्थान सरकार की योजनाओं के विशेषज्ञ विश्लेषक हैं। 

पात्रता विश्लेषण नियम (Strict Rules):
1. पात्र योजनाएं (ELIGIBLE): केवल वही योजनाएं दें जिनके लिए उपयोगकर्ता 100% पात्र है।
2. सशर्त योजनाएं (CONDITIONAL): ऐसी ठीक 5 योजनाएं चुनें जहाँ उपयोगकर्ता 80% पात्र है, और बताएं कि बाकी 20% शर्तें कैसे पूरी की जा सकती हैं।
3. प्रोफाइल मिलान: आयु, लिंग, आय, स्थान और शिक्षा का सटीक उपयोग करें।
4. भाषा: शुद्ध हिंदी।

अनिवार्य JSON फॉर्मेट का पालन करें।`;

const SCHEME_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    eligible_schemes: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          yojana_name: { type: Type.STRING },
          government: { type: Type.STRING },
          category: { type: Type.STRING },
          short_purpose_hindi: { type: Type.STRING },
          detailed_benefits: { type: Type.STRING },
          eligibility_criteria: { type: Type.ARRAY, items: { type: Type.STRING } },
          eligibility_status: { type: Type.STRING, description: "'ELIGIBLE' or 'CONDITIONAL'" },
          eligibility_reason_hindi: { type: Type.STRING },
          required_documents: { type: Type.ARRAY, items: { type: Type.STRING } },
          form_source: { type: Type.STRING },
          application_type: { type: Type.STRING },
          signatures_required: { type: Type.ARRAY, items: { type: Type.STRING } },
          submission_point: { type: Type.STRING },
          official_pdf_link: { type: Type.STRING }
        },
        required: ["yojana_name", "eligibility_status", "eligibility_reason_hindi"]
      }
    }
  },
  required: ["eligible_schemes"]
};

export async function analyzeEligibility(profile: UserProfile, isDummy: boolean): Promise<AnalysisResponse> {
  const profileHash = btoa(unescape(encodeURIComponent(JSON.stringify(profile))));
  const cached = await dbService.getCache(profileHash);
  if (cached) return cached;

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `उपयोगकर्ता प्रोफाइल: ${JSON.stringify(profile)}. 
    कृपया सभी 'ELIGIBLE' योजनाएं और अधिकतम 5 'CONDITIONAL' योजनाएं प्रदान करें।`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: SCHEME_SCHEMA,
        temperature: 0.3
      }
    });

    const parsed = JSON.parse(response.text || "{}");
    const aiSchemes: Scheme[] = parsed.eligible_schemes || [];

    // Local filter just in case the AI provides more than 5 conditional schemes
    const eligible = aiSchemes.filter(s => s.eligibility_status === 'ELIGIBLE');
    const conditional = aiSchemes.filter(s => s.eligibility_status === 'CONDITIONAL').slice(0, 5);
    
    const finalSchemes = [...eligible, ...conditional];

    // Save newly discovered schemes to DB
    finalSchemes.forEach(s => dbService.upsertScheme(s));

    const result: AnalysisResponse = {
      hindiContent: "Gemini AI विश्लेषण पूर्ण। हमने आपकी प्रोफाइल के लिए सबसे सटीक परिणामों का चयन किया है।",
      eligible_schemes: finalSchemes,
      timestamp: Date.now()
    };

    await dbService.saveCache(profileHash, result);
    return result;

  } catch (e) {
    console.error("AI Analysis Failed:", e);
    // Fallback logic
    const dbSchemes = await dbService.getAllSchemes();
    const filtered = dbSchemes.filter(s => {
      if (s.government === 'Rajasthan Govt' && profile.state !== 'Rajasthan') return false;
      const isFemale = s.yojana_name.includes("महिला") || s.yojana_name.includes("छात्रा");
      if (isFemale && profile.gender === 'Male') return false;
      return true;
    }).slice(0, 5);

    return {
      hindiContent: "AI सेवा अभी व्यस्त है। आपकी प्रोफाइल के लिए कुछ मुख्य योजनाएं यहाँ दी गई हैं:",
      eligible_schemes: filtered
    };
  }
}

export async function testApiConnection(): Promise<boolean> {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: 'hi',
    });
    return !!response.text;
  } catch (e) {
    return false;
  }
}
