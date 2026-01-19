
import { GoogleGenAI } from "@google/genai";
import { UserProfile, AnalysisResponse, Scheme } from "../types";
import { dbService } from "./dbService";

const SYSTEM_INSTRUCTION = `आप भारत सरकार और राजस्थान सरकार की योजनाओं के विशेषज्ञ विश्लेषक हैं। 

पात्रता विश्लेषण नियम (Accuracy & Inclusivity Rules):
1. समावेशी दृष्टिकोण (Inclusivity): यदि उपयोगकर्ता किसी योजना की 80% शर्तें पूरी करता है, तो उसे 'CONDITIONAL' के रूप में दिखाएं और बताएं कि बाकी 20% शर्तें कैसे पूरी की जा सकती हैं।
2. सशर्त पात्रता (Conditional Eligibility): "सशर्त पात्र" (Conditional) श्रेणी का उपयोग उन योजनाओं के लिए करें जहाँ लाभ किसी विशेष घटना पर निर्भर है।
3. प्रोफाइल मिलान: उपयोगकर्ता के 30+ मापदंडों का उपयोग करें। डूंगरपुर, बांसवाड़ा जैसे जिलों के लिए TSP लाभों को शामिल करें।
4. योजनाओं का कोटा: कम से कम 15-20 योजनाओं की विस्तृत सूची दें। 
5. भाषा और प्रारूप: सारा विवरण शुद्ध हिंदी में हो। परिणाम अनिवार्य रूप से JSON ऑब्जेक्ट में 'eligible_schemes' ऐरे के साथ हो।

JSON को ---JSON_START--- और ---JSON_END--- के बीच रखें।`;

function robustJsonParse(text: string): any {
  if (!text) return null;
  try {
    // Strategy 1: Explicit tags
    const tagged = text.match(/---JSON_START---([\s\S]*?)---JSON_END---/);
    if (tagged) {
      const parsed = JSON.parse(tagged[1].trim());
      return parsed.eligible_schemes || (Array.isArray(parsed) ? parsed : null);
    }
    // Strategy 2: Markdown block
    const md = text.match(/```json\s*([\s\S]*?)\s*```/i);
    if (md) {
      const parsed = JSON.parse(md[1].trim());
      return parsed.eligible_schemes || (Array.isArray(parsed) ? parsed : null);
    }
    // Strategy 3: Search for first { or [ and last } or ]
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
    console.error("AI JSON Parse Error (Robust):", e);
  }
  return null;
}

export async function testApiConnection(provider: 'gemini' | 'groq', key: string): Promise<boolean> {
  // Use VITE_API_KEY from environment as requested, fall back to process.env.API_KEY
  const apiKey = (import.meta as any).env.VITE_API_KEY || process.env.API_KEY;
  const finalKey = key || apiKey;
  
  if (!finalKey) return false;
  try {
    if (provider === 'gemini') {
      const ai = new GoogleGenAI({ apiKey: finalKey });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: 'test connection, respond "ok"',
      });
      return !!response.text;
    } else {
      const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${finalKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "user", content: "hi" }],
          max_tokens: 5
        })
      });
      return resp.ok;
    }
  } catch (e) { return false; }
}

async function analyzeWithGemini(profile: UserProfile, key: string): Promise<AnalysisResponse> {
  const ai = new GoogleGenAI({ apiKey: key });
  const prompt = `उपयोगकर्ता प्रोफाइल डेटा: ${JSON.stringify(profile)}.
  कृपया 20 योजनाओं की सूची दें। समावेशिता सुनिश्चित करें। 
  सशर्त पात्र (Conditional) योजनाओं को स्पष्ट तर्क के साथ जोड़ें। 
  बीमा योजनाओं को केवल 2-3 तक रखें। 
  विशेष रूप से राजस्थान के मेधावी स्नातक छात्रों और ग्रामीण महिलाओं के लिए योजनाओं पर ध्यान दें।`;
  
  const res = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: prompt,
    config: { systemInstruction: SYSTEM_INSTRUCTION, tools: [{ googleSearch: {} }], temperature: 0.8 }
  });
  
  const raw = res.text || "";
  const aiSchemes = robustJsonParse(raw) || [];

  if (aiSchemes.length > 0) {
    aiSchemes.forEach((s: Scheme) => dbService.upsertScheme(s));
  }

  return {
    hindiContent: raw.split(/---JSON_START---|```json|\[|\{/)[0].trim() || "यहाँ आपकी प्रोफाइल के आधार पर सटीक विश्लेषण दिया गया है:",
    eligible_schemes: aiSchemes,
  };
}

export async function analyzeEligibility(profile: UserProfile, isDummy: boolean): Promise<AnalysisResponse> {
  const profileHash = btoa(unescape(encodeURIComponent(JSON.stringify(profile))));
  const cached = await dbService.getCache(profileHash);
  if (cached) return cached;

  const dbSchemes = await dbService.getAllSchemes();
  
  const filteredDb = dbSchemes.filter(s => {
    if (s.government === 'Rajasthan Govt' && profile.state !== 'Rajasthan') return false;
    if (s.yojana_name.includes("महिला") || s.yojana_name.includes("छात्रा") || s.category.includes("Women")) {
       if (profile.gender === 'Male') return false;
    }
    return true;
  });

  const savedKeys = await dbService.getSetting<any>('api_keys');
  
  // Priority: Saved Keys (Admin) -> VITE_API_KEY (Vercel) -> process.env.API_KEY (System)
  const apiKey = (import.meta as any).env.VITE_API_KEY || process.env.API_KEY;
  const geminiKey = savedKeys?.gemini || apiKey;

  if (geminiKey) {
    try {
      const aiResult = await analyzeWithGemini(profile, geminiKey);
      const seen = new Set(filteredDb.map(s => s.yojana_name));
      const combined = [...filteredDb];
      
      if (aiResult.eligible_schemes && aiResult.eligible_schemes.length > 0) {
        aiResult.eligible_schemes.forEach(s => {
          if (!seen.has(s.yojana_name)) {
            combined.push(s);
            seen.add(s.yojana_name);
          }
        });
      }
      
      const finalResult = { ...aiResult, eligible_schemes: combined };
      await dbService.saveCache(profileHash, finalResult);
      return finalResult;
    } catch (e) {
      console.warn("AI logic failed, falling back to database results", e);
      return { hindiContent: "डेटाबेस से प्राप्त परिणाम (AI त्रुटि):", eligible_schemes: filteredDb };
    }
  }

  return { hindiContent: "डेटाबेस से प्राप्त परिणाम (कृपया Admin में API Key सेट करें या Vercel में जोड़ें):", eligible_schemes: filteredDb };
}
