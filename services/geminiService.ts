
import { GoogleGenAI } from "@google/genai";
import { UserProfile, AnalysisResponse, Scheme } from "../types";
import { dbService } from "./dbService";

const SYSTEM_INSTRUCTION = `आप भारत सरकार और राजस्थान सरकार की योजनाओं के विशेषज्ञ विश्लेषक हैं। 
आपका कार्य उपयोगकर्ता की प्रोफाइल के आधार पर कम से कम 10 से 15 ऐसी योजनाएं खोजना है जिनमें उपयोगकर्ता के लाभ की संभावना हो।

नियम:
1. अधिकतम परिणाम: यदि उपयोगकर्ता पूरी तरह फिट नहीं भी है, तो भी 'CONDITIONAL' श्रेणी में योजना दिखाएं। 
2. 'अपात्र' (NOT_ELIGIBLE) परिणाम न दिखाएं: केवल वे योजनाएं दिखाएं जहां उपयोगकर्ता 'ELIGIBLE' या 'CONDITIONAL' (यदि वे कुछ दस्तावेज जमा करें) हो।
3. खोज का दायरा: सामाजिक सुरक्षा, पेंशन, छात्रवृत्ति, स्वास्थ्य (चिरंजीवी/आयुष्मान), किसान सहायता, और महिला सशक्तिकरण की योजनाओं पर ध्यान दें।
4. भाषा: सभी जानकारी शुद्ध हिंदी (Devanagari) में होनी चाहिए।
5. डेटा स्रोत: केवल 2024-2025 और आगामी 2026 की सक्रिय योजनाओं का उपयोग करें।

JSON संरचना:
प्रत्येक योजना के लिए निम्नलिखित फ़ील्ड अनिवार्य हैं:
- yojana_name, government, detailed_benefits, eligibility_status (ELIGIBLE या CONDITIONAL), eligibility_reason_hindi, required_documents (array), application_type, signatures_required (array), submission_point, official_pdf_link.

आउटपुट को ---JSON_START--- और ---JSON_END--- के बीच रखें।`;

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
  const prompt = `उपयोगकर्ता प्रोफाइल के लिए कम से कम 10 सरकारी योजनाओं की खोज करें: ${JSON.stringify(profile)}. 
  विशेष रूप से राजस्थान और केंद्र सरकार की ऐसी योजनाएं खोजें जिनमें उपयोगकर्ता 'पात्र' (Eligible) हो सकता है। 
  यदि उपयोगकर्ता सीधे पात्र नहीं है, तो 'शर्तों के साथ पात्र' (Conditional) श्रेणी में रखें और कारण बताएं। 'अपात्र' (Not Eligible) न दिखाएं।`;

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
    hindiContent: raw.split(/---JSON_START---|```json|\[/)[0].trim() || "यहाँ आपके लिए खोजी गई प्रमुख योजनाएं हैं:",
    eligible_schemes: schemes,
    groundingSources: res.candidates?.[0]?.groundingMetadata?.groundingChunks || []
  };
}

async function analyzeWithGroq(profile: UserProfile, key: string): Promise<AnalysisResponse> {
  const prompt = `${SYSTEM_INSTRUCTION}\n\nUSER PROFILE: ${JSON.stringify(profile)}\n\nप्रोफाइल के आधार पर 10 सर्वश्रेष्ठ 'पात्र' योजनाओं की सूची JSON में दें।`;
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
