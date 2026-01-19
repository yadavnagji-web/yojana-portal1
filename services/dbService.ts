
import { Scheme, UserProfile, AnalysisResponse, CachedAnalysis } from "../types";

const DB_NAME = "SarkariYojanaMasterDB";
const DB_VERSION = 14; 
const SCHEME_STORE = "schemes";
const SETTINGS_STORE = "settings";
const CACHE_STORE = "analysis_cache";
const USER_RECORDS_STORE = "user_submissions";

const MASTER_SCHEMES: Scheme[] = [
  {
    yojana_name: "अटल पेंशन योजना (Atal Pension Yojana - APY)",
    government: "Central Govt",
    category: "Social Security",
    short_purpose_hindi: "पेंशन सुरक्षा",
    detailed_benefits: "1000 से 5000 रुपये तक की गारंटीड मासिक पेंशन। 60 वर्ष के बाद पेंशन शुरू होती है। यह योजना असंगठित क्षेत्र के श्रमिकों के लिए बुढ़ापे का सहारा है।",
    eligibility_criteria: ["उम्र 18-40 वर्ष", "आयकर दाता नहीं होना चाहिए", "बैंक खाता अनिवार्य"],
    eligibility_status: "ELIGIBLE",
    eligibility_reason_hindi: "आपकी आयु और आय का स्तर इस योजना की प्राथमिक शर्तों को पूरा करता है। यदि आप इनकम टैक्स नहीं भरते हैं, तो आप सीधे पात्र हैं।",
    required_documents: ["आधार कार्ड", "बैंक पासबुक", "सक्रिय मोबाइल नंबर"],
    form_source: "बैंक शाखा या पोस्ट ऑफिस",
    application_type: "Both",
    signatures_required: ["स्वयं (आवेदक)"],
    submission_point: "अपनी बैंक शाखा जहाँ खाता है",
    official_pdf_link: "https://www.npscra.nsdl.co.in/scheme-details.php",
    scheme_status: "ACTIVE"
  },
  {
    yojana_name: "PM जीवन ज्योति बीमा योजना (PMJJBY)",
    government: "Central Govt",
    category: "Insurance",
    short_purpose_hindi: "जीवन बीमा",
    detailed_benefits: "2 लाख रुपये का जीवन बीमा कवर। किसी भी कारण से मृत्यु होने पर नॉमिनी को भुगतान। वार्षिक प्रीमियम मात्र 436 रुपये।",
    eligibility_criteria: ["उम्र 18-50 वर्ष", "बैंक खाता", "ऑटो-डेबिट सहमति"],
    eligibility_status: "ELIGIBLE",
    eligibility_reason_hindi: "50 वर्ष से कम आयु के सभी बैंक खाताधारक इसके पात्र हैं। यह एक शुद्ध जीवन सुरक्षा योजना है।",
    required_documents: ["आधार कार्ड", "सहमति पत्र"],
    form_source: "बैंक या बीमा कंपनी पोर्टल",
    application_type: "Online",
    signatures_required: ["आवेदक"],
    submission_point: "बैंक मैनेजर / ऑनलाइन नेट बैंकिंग",
    official_pdf_link: "https://jansuraksha.gov.in/",
    scheme_status: "ACTIVE"
  },
  {
    yojana_name: "कालीबाई भील मेधावी छात्रा स्कूटी योजना",
    government: "Rajasthan Govt",
    category: "Education",
    short_purpose_hindi: "मेधावी छात्राओं हेतु स्कूटी",
    detailed_benefits: "राजस्थान की छात्राओं को उच्च शिक्षा हेतु नि:शुल्क स्कूटी, हेलमेट, और पंजीकरण शुल्क की सहायता।",
    eligibility_criteria: ["न्यूनतम 65-75% अंक (बोर्ड अनुसार)", "स्नातक में नियमित प्रवेश", "आय ₹2.5 लाख से कम"],
    eligibility_status: "CONDITIONAL",
    eligibility_reason_hindi: "यदि आपने 12वीं में अच्छे अंक प्राप्त किए हैं और अभी स्नातक (Graduate) कर रही हैं, तो आप मेरिट के आधार पर पात्र हैं।",
    required_documents: ["12वीं की अंकतालिका", "जन-आधार", "कॉलेज प्रवेश प्रमाणपत्र", "मूल निवास"],
    form_source: "SSO Portal (Scholarship SJE)",
    application_type: "Online",
    signatures_required: ["स्वयं", "संस्था प्रधान"],
    submission_point: "कॉलेज / ऑनलाइन SSO",
    official_pdf_link: "https://hte.rajasthan.gov.in/",
    scheme_status: "ACTIVE"
  },
  {
    yojana_name: "मुख्यमंत्री चिरंजीवी स्वास्थ्य बीमा योजना",
    government: "Rajasthan Govt",
    category: "Health",
    short_purpose_hindi: "25 लाख का मुफ्त इलाज",
    detailed_benefits: "परिवार को 25 लाख रुपये तक का कैशलेस इलाज। दुर्घटना बीमा 10 लाख रुपये अलग से।",
    eligibility_criteria: ["जन-आधार कार्ड", "राजस्थान निवासी", "NFSA/BPL परिवारों हेतु नि:शुल्क"],
    eligibility_status: "ELIGIBLE",
    eligibility_reason_hindi: "राजस्थान के सभी निवासी पात्र हैं। यदि आप BPL नहीं हैं, तो 850 रुपये प्रीमियम देकर पात्र बन सकते हैं।",
    required_documents: ["जन-आधार कार्ड", "राशन कार्ड"],
    form_source: "ई-मित्र / SSO Portal",
    application_type: "Online",
    signatures_required: ["मुखिया / स्वयं"],
    submission_point: "निकटतम ई-मित्र केंद्र",
    official_pdf_link: "https://chiranjeevi.rajasthan.gov.in/",
    scheme_status: "ACTIVE"
  },
  {
    yojana_name: "PM मातृ वंदना योजना (PMMVY 2.0)",
    government: "Central Govt",
    category: "Women Welfare",
    short_purpose_hindi: "गर्भावस्था वित्तीय सहायता",
    detailed_benefits: "पहली संतान पर ₹5000 और दूसरी संतान (बालिका) पर ₹6000 की सहायता सीधे बैंक खाते में।",
    eligibility_criteria: ["गर्भवती महिला", "आधार लिंक बैंक खाता", "सरकारी कर्मचारी न हो"],
    eligibility_status: "CONDITIONAL",
    eligibility_reason_hindi: "विवाहित महिलाओं हेतु पहली या दूसरी संतान के समय यह लाभ मिलता है। आंगनवाड़ी पंजीकरण अनिवार्य है।",
    required_documents: ["MCP कार्ड (ममता कार्ड)", "आधार", "बच्चे का जन्म प्रमाण पत्र"],
    form_source: "आंगनवाड़ी केंद्र / PMMVY पोर्टल",
    application_type: "Both",
    signatures_required: ["स्वयं", "पति"],
    submission_point: "क्षेत्र की आंगनवाड़ी कार्यकर्ता",
    official_pdf_link: "https://pmmvy.nic.in/",
    scheme_status: "ACTIVE"
  },
  {
    yojana_name: "इन्दिरा गांधी राष्ट्रीय वृद्धावस्था पेंशन योजना",
    government: "Central Govt",
    category: "Pension",
    short_purpose_hindi: "वृद्धों हेतु मासिक पेंशन",
    detailed_benefits: "60-75 वर्ष की आयु पर ₹1000 और 75+ पर ₹1500 मासिक पेंशन।",
    eligibility_criteria: ["BPL परिवार", "न्यूनतम आयु 60 वर्ष", "कोई अन्य आय का स्रोत न हो"],
    eligibility_status: "CONDITIONAL",
    eligibility_reason_hindi: "यदि आपकी आयु 60 वर्ष पूर्ण हो जाती है और आप BPL श्रेणी में हैं, तो आप तुरंत पात्र होंगे।",
    required_documents: ["जन-आधार", "आधार", "BPL प्रमाण", "आयु प्रमाण"],
    form_source: "ई-मित्र / राज-एसएसपी पोर्टल",
    application_type: "Both",
    signatures_required: ["स्वयं"],
    submission_point: "पेंशन कार्यालय / ई-मित्र",
    official_pdf_link: "https://rajssp.raj.nic.in/",
    scheme_status: "ACTIVE"
  }
];

export class DBService {
  private static instance: DBService;
  private db: IDBDatabase | null = null;

  private constructor() {}

  public static getInstance(): DBService {
    if (!DBService.instance) DBService.instance = new DBService();
    return DBService.instance;
  }

  public async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.db) return resolve();
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (db.objectStoreNames.contains(SCHEME_STORE)) db.deleteObjectStore(SCHEME_STORE);
        db.createObjectStore(SCHEME_STORE, { keyPath: "yojana_name" });

        if (db.objectStoreNames.contains(SETTINGS_STORE)) db.deleteObjectStore(SETTINGS_STORE);
        db.createObjectStore(SETTINGS_STORE);

        if (db.objectStoreNames.contains(CACHE_STORE)) db.deleteObjectStore(CACHE_STORE);
        db.createObjectStore(CACHE_STORE, { keyPath: "profileHash" });

        if (db.objectStoreNames.contains(USER_RECORDS_STORE)) db.deleteObjectStore(USER_RECORDS_STORE);
        db.createObjectStore(USER_RECORDS_STORE, { autoIncrement: true });
      };

      request.onsuccess = async (e) => { 
        this.db = (e.target as IDBOpenDBRequest).result; 
        await this.seedMasterData();
        resolve(); 
      };
      request.onerror = (e) => reject((e.target as IDBOpenDBRequest).error);
    });
  }

  private async seedMasterData(): Promise<void> {
    for (const s of MASTER_SCHEMES) {
      await this.upsertScheme(s);
    }
  }

  public async saveCache(hash: string, response: AnalysisResponse): Promise<void> {
    if (!this.db) await this.init();
    if (!hash) return;
    const tx = this.db!.transaction(CACHE_STORE, "readwrite");
    tx.objectStore(CACHE_STORE).put({ profileHash: hash, response, timestamp: Date.now() });
  }

  public async getCache(hash: string): Promise<AnalysisResponse | null> {
    if (!this.db) await this.init();
    if (!hash) return null;
    return new Promise((resolve) => {
      const tx = this.db!.transaction(CACHE_STORE, "readonly");
      const req = tx.objectStore(CACHE_STORE).get(hash);
      req.onsuccess = () => resolve(req.result ? req.result.response : null);
      req.onerror = () => resolve(null);
    });
  }

  public async getSetting<T>(key: string): Promise<T | null> {
    if (!this.db) await this.init();
    return new Promise((resolve) => {
      const tx = this.db!.transaction(SETTINGS_STORE, "readonly");
      const req = tx.objectStore(SETTINGS_STORE).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  }

  public async setSetting(key: string, value: any): Promise<void> {
    if (!this.db) await this.init();
    const tx = this.db!.transaction(SETTINGS_STORE, "readwrite");
    tx.objectStore(SETTINGS_STORE).put(value, key);
  }

  public async getAllSchemes(): Promise<Scheme[]> {
    if (!this.db) await this.init();
    return new Promise((resolve) => {
      const tx = this.db!.transaction(SCHEME_STORE, "readonly");
      const req = tx.objectStore(SCHEME_STORE).getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve([]);
    });
  }

  public async upsertScheme(scheme: Scheme): Promise<void> {
    if (!this.db) await this.init();
    if (!scheme || !scheme.yojana_name) return;
    const tx = this.db!.transaction(SCHEME_STORE, "readwrite");
    tx.objectStore(SCHEME_STORE).put(scheme);
  }
}

export const dbService = DBService.getInstance();
