
import { UserProfile, AnalysisResponse, Scheme } from "../types";
import { dbService } from "./dbService";

const GROQ_MODEL = "llama-3.3-70b-versatile";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

/**
 * System Instruction focused on REAL database matching.
 */
const SYSTEM_INSTRUCTION = `आप भारत सरकार और राजस्थान सरकार की योजनाओं के विशेषज्ञ विश्लेषक हैं। 

पात्रता विश्लेषण नियम (Strict Selection Rules):
1. आपका मुख्य कार्य उपयोगकर्ता की प्रोफाइल को प्रदान की गई योजनाओं की सूची (डेटाबेस) से मिलाना है।
2. पात्र योजनाएं (ELIGIBLE): केवल वे ही योजनाएं दें जिनके लिए उपयोगकर्ता 100% पात्र है।
3. सशर्त योजनाएं (CONDITIONAL): ऐसी ठीक 5 योजनाएं चुनें जहाँ उपयोगकर्ता 80% पात्रता पूरी करता है।
4. महत्वपूर्ण: प्रत्येक योजना के लिए 'other_eligibility_suggestions_hindi' फील्ड जोड़ें, जिसमें यह बताएं कि उपयोगकर्ता अन्य संबंधित योजनाओं के लिए पात्र होने हेतु क्या कदम उठा सकता है (जैसे नए दस्तावेज बनवाना, राशन कार्ड अपडेट करना, या कौशल प्रशिक्षण लेना)।
5. महत्वपूर्ण: काल्पनिक योजनाएं न बनाएं। केवल प्रदान किए गए डेटाबेस का उपयोग करें।
6. भाषा: शुद्ध और आधिकारिक हिंदी।
7. प्रारूप: अनिवार्य रूप से 'eligible_schemes' ऐरे के साथ JSON उत्तर दें।`;

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
  const masterSchemes = await dbService.getAllSchemes();

  // Filter schemes locally first to save context window (Basic state/gender check)
  const relevantSchemes = masterSchemes.filter(s => {
    if (s.government === 'Rajasthan Govt' && profile.state !== 'Rajasthan') return false;
    return true;
  });

  if (!apiKey) {
    return {
      hindiContent: "त्रुटि: API कुंजी सेट नहीं है। स्थानीय डेटाबेस से परिणाम दिखा रहे हैं।",
      eligible_schemes: relevantSchemes.slice(0, 10)
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
          { role: "user", content: `उपयोगकर्ता प्रोफाइल: ${JSON.stringify(profile)}. \n\nउपलब्ध योजनाएं (डेटाबेस): ${JSON.stringify(relevantSchemes)}. \n\nकृपया इस डेटाबेस से सर्वश्रेष्ठ मिलान खोजें और अन्य योजनाओं हेतु पात्रता सुझाव (suggestions) भी प्रदान करें।` }
        ],
        temperature: 0.1, // Low temperature for high precision matching
        response_format: { type: "json_object" }
      })
    });

    if (response.status === 429) throw new Error("DATA_EXHAUSTED");
    if (!response.ok) throw new Error(`API Error: ${response.status}`);

    const data = await response.json();
    const rawContent = data.choices[0]?.message?.content || "";
    const aiSchemes = extractSchemesFromText(rawContent);

    // Final sorting and filtering
    const eligible = aiSchemes.filter(s => s.eligibility_status === 'ELIGIBLE');
    const conditional = aiSchemes.filter(s => s.eligibility_status === 'CONDITIONAL').slice(0, 5);
    const finalSchemes = [...eligible, ...conditional];

    const result: AnalysisResponse = {
      hindiContent: "प्रामाणिक सरकारी डेटाबेस से मिलान पूर्ण। हमने आपकी प्रोफाइल के आधार पर सबसे सटीक योजनाओं की पहचान की है और कुछ भविष्य के सुझाव भी जोड़े हैं।",
      eligible_schemes: finalSchemes,
      timestamp: Date.now()
    };

    await dbService.saveCache(profileHash, result);
    return result;

  } catch (e: any) {
    console.error("Analysis Error:", e);
    
    // Fallback: Smart Local Matching if AI fails
    const fallbackSchemes = relevantSchemes.filter(s => {
       const name = s.yojana_name.toLowerCase();
       if (profile.gender === 'Male' && (name.includes('महिला') || name.includes('छात्रा') || name.includes('मातृ'))) return false;
       if (profile.is_farmer === 'No' && (name.includes('किसान') || name.includes('कृषि'))) return false;
       return true;
    }).slice(0, 10);

    return {
      hindiContent: e.message === "DATA_EXHAUSTED" 
        ? "क्षमा करें, API सीमा समाप्त हो गई है। स्थानीय डेटाबेस से वास्तविक परिणाम दिखा रहे हैं:" 
        : "AI सेवा अभी व्यस्त है। डेटाबेस से सीधे मिलान किए गए परिणाम यहाँ हैं:",
      eligible_schemes: fallbackSchemes
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
