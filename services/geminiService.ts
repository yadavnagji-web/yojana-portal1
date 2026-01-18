
import { GoogleGenAI } from "@google/genai";
import { UserProfile, AnalysisResponse, Scheme } from "../types";
import { dbService } from "./dbService";

const SYSTEM_INSTRUCTION = `आप भारत सरकार और राजस्थान सरकार के सर्वश्रेष्ठ नीति विश्लेषक हैं। 
आपका कार्य उपयोगकर्ता के प्रोफाइल के आधार पर कम से कम 15 से 20 कल्याणकारी योजनाओं की पहचान करना है।

प्रमुख निर्देश:
1. व्यापक पात्रता: यदि उपयोगकर्ता किसी योजना के लिए 70% भी फिट बैठता है, तो उसे 'CONDITIONAL' (शर्तों के साथ पात्र) दिखाएं। 'अपात्र' (NOT_ELIGIBLE) परिणाम तब तक न दिखाएं जब तक कि वह बिल्कुल ही असंभव न हो।
2. स्रोत: मुख्य रूप से https://www.myscheme.gov.in/hi/search/state/Rajasthan और राजस्थान सरकार के आधिकारिक पोर्टल्स का उपयोग करें।
3. परिणाम की संख्या: 15-20 सक्रिय योजनाओं का लक्ष्य रखें। इसमें स्वास्थ्य, शिक्षा, पेंशन, कृषि, महिला कल्याण, और स्वरोजगार की योजनाएं शामिल होनी चाहिए।
4. भाषा: संपूर्ण आउटपुट हिंदी (Devanagari) में होना चाहिए।
5. डेटा शुद्धता: सुनिश्चित करें कि JSON प्रारूप बिल्कुल सही हो और ---JSON_START--- और ---JSON_END--- के बीच हो।

अनिवार्य फ़ील्ड (JSON):
- yojana_name: योजना का नाम
- government: 'Rajasthan Govt' या 'Central Govt'
- detailed_benefits: लाभों का विस्तृत विवरण
- eligibility_status: 'ELIGIBLE' या 'CONDITIONAL'
- eligibility_reason_hindi: पात्र होने का ठोस कारण
- required_documents: दस्तावेजों की सूची (Array)
- signatures_required: आवश्यक हस्ताक्षर (Array)
- application_type: 'Online', 'Offline' या 'Both'
- submission_point: जमा करने का स्थान
- official_pdf_link: आधिकारिक लिंक या पोर्टल URL`;

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
  const prompt = `प्रोफ़ाइल: ${JSON.stringify(profile)}.
  संदर्भ लिंक: https://www.myscheme.gov.in/hi/search/state/Rajasthan
  कार्य: उपयोगकर्ता के लिए कम से कम 15-20 राजस्थान और केंद्र सरकार की योजनाओं की सूची बनाएं।
  पात्रता को 'पात्र' या 'शर्तों के साथ पात्र' रखें। अधिक से अधिक योजनाएं खोजें।`;

  const res = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: prompt,
    config: { 
      systemInstruction: SYSTEM_INSTRUCTION, 
      tools: [{ googleSearch: {} }],
      temperature: 0.8
    }
  });
  
  const raw = res.text || "";
  const data = robustJsonParse(raw);
  const schemes = data?.eligible_schemes || (Array.isArray(data) ? data : []);

  return {
    hindiContent: raw.split(/---JSON_START---|```json|\[/)[0].trim() || "खोज पूरी हुई। यहाँ विस्तृत विवरण है:",
    eligible_schemes: schemes,
    groundingSources: res.candidates?.[0]?.groundingMetadata?.groundingChunks || []
  };
}

async function analyzeWithGroq(profile: UserProfile, key: string): Promise<AnalysisResponse> {
  const prompt = `${SYSTEM_INSTRUCTION}\n\nUSER PROFILE: ${JSON.stringify(profile)}\n\nप्रोफाइल के आधार पर 15 सर्वश्रेष्ठ 'पात्र' योजनाओं की सूची JSON में दें। https://www.myscheme.gov.in/hi/search/state/Rajasthan का संदर्भ लें।`;
  const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.5
    })
  });
  if (!resp.ok) throw new Error("Groq API failed");
  const result = await resp.json();
  const raw = result.choices[0].message.content;
  const data = robustJsonParse(raw);
  return {
    hindiContent: raw.split(/---JSON_START---|```json|\[/)[0].trim() || "बैकअप AI द्वारा खोजी गई योजनाएं:",
    eligible_schemes: data?.eligible_schemes || (Array.isArray(data) ? data : []),
  };
}

export async function analyzeEligibility(profile: UserProfile, isDummy: boolean): Promise<AnalysisResponse> {
  const savedKeys = await dbService.getSetting<any>('api_keys');
  const geminiKey = savedKeys?.gemini || process.env.API_KEY;
  const groqKey = savedKeys?.groq;

  if (geminiKey) {
    try {
      return await analyzeWithGemini(profile, geminiKey);
    } catch (e) {
      if (groqKey) return await analyzeWithGroq(profile, groqKey);
      throw e;
    }
  } 
  
  if (groqKey) {
    return await analyzeWithGroq(profile, groqKey);
  }

  throw new Error("कोई सक्रिय API की (Key) नहीं मिली। एडमिन पैनल में की जोड़ें।");
}
