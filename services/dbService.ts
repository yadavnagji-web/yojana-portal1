
import { Scheme, UserProfile, AnalysisResponse, CachedAnalysis } from "../types";

const DB_NAME = "SarkariYojanaMasterDB";
const DB_VERSION = 17; // Incremented version to trigger fresh seeding
const SCHEME_STORE = "schemes";
const SETTINGS_STORE = "settings";
const CACHE_STORE = "analysis_cache";
const USER_RECORDS_STORE = "user_submissions";

export class DBService {
  private static instance: DBService;
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  private constructor() {}

  public static getInstance(): DBService {
    if (!DBService.instance) DBService.instance = new DBService();
    return DBService.instance;
  }

  public async init(): Promise<void> {
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      if (navigator.storage && navigator.storage.persist) {
        navigator.storage.persist().then(persistent => {
          if (persistent) console.debug("Storage will not be cleared by the browser.");
        });
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains(SCHEME_STORE)) {
          db.createObjectStore(SCHEME_STORE, { keyPath: "yojana_name" });
        }
        if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
          db.createObjectStore(SETTINGS_STORE);
        }
        if (!db.objectStoreNames.contains(CACHE_STORE)) {
          db.createObjectStore(CACHE_STORE, { keyPath: "profileHash" });
        }
        if (!db.objectStoreNames.contains(USER_RECORDS_STORE)) {
          db.createObjectStore(USER_RECORDS_STORE, { autoIncrement: true });
        }
      };

      request.onsuccess = async (e) => { 
        this.db = (e.target as IDBOpenDBRequest).result; 
        
        this.db.onversionchange = () => {
          this.db?.close();
          window.location.reload();
        };

        await this.seedMasterData();
        resolve(); 
      };
      request.onerror = (e) => reject((e.target as IDBOpenDBRequest).error);
    });

    return this.initPromise;
  }

  private async seedMasterData(): Promise<void> {
    const MASTER_SCHEMES: Scheme[] = [
      {
        yojana_name: "मुख्यमंत्री चिरंजीवी स्वास्थ्य बीमा योजना (Rajasthan)",
        government: "Rajasthan Govt",
        category: "Health",
        short_purpose_hindi: "नि:शुल्क इलाज",
        detailed_benefits: "25 लाख रुपये तक का कैशलेस स्वास्थ्य बीमा।",
        eligibility_criteria: ["राजस्थान का मूल निवासी", "जन-आधार कार्ड धारक"],
        eligibility_status: "ELIGIBLE",
        eligibility_reason_hindi: "आप राजस्थान के निवासी हैं और आपके पास जन-आधार है।",
        required_documents: ["जन-आधार कार्ड", "आधार कार्ड"],
        form_source: "e-Mitra / Chiranjeevi Portal",
        application_type: "Online",
        signatures_required: ["स्वयं"],
        submission_point: "e-Mitra / Online Portal",
        official_pdf_link: "https://chiranjeevi.rajasthan.gov.in/",
        scheme_status: "ACTIVE"
      },
      {
        yojana_name: "अटल पेंशन योजना (Atal Pension Yojana - APY)",
        government: "Central Govt",
        category: "Social Security",
        short_purpose_hindi: "पेंशन सुरक्षा",
        detailed_benefits: "1000 से 5000 रुपये तक की गारंटीड मासिक पेंशन।",
        eligibility_criteria: ["उम्र 18-40 वर्ष", "आयकर दाता नहीं होना चाहिए"],
        eligibility_status: "ELIGIBLE",
        eligibility_reason_hindi: "आपकी आयु और आय उपयुक्त है।",
        required_documents: ["आधार कार्ड", "बैंक पासबुक"],
        form_source: "बैंक शाखा",
        application_type: "Both",
        signatures_required: ["स्वयं"],
        submission_point: "बैंक",
        official_pdf_link: "https://www.npscra.nsdl.co.in/scheme-details.php",
        scheme_status: "ACTIVE"
      },
      {
        yojana_name: "मुख्यमंत्री जन-आधार योजना (Rajasthan)",
        government: "Rajasthan Govt",
        category: "Identification",
        short_purpose_hindi: "एक नंबर, एक कार्ड, एक पहचान",
        detailed_benefits: "सभी सरकारी योजनाओं का लाभ सीधे बैंक खाते में (DBT)।",
        eligibility_criteria: ["राजस्थान के निवासी"],
        eligibility_status: "ELIGIBLE",
        eligibility_reason_hindi: "राजस्थान के सभी परिवारों के लिए अनिवार्य पहचान कार्ड।",
        required_documents: ["आधार कार्ड", "राशन कार्ड", "बैंक विवरण"],
        form_source: "Jan-Aadhar Portal",
        application_type: "Online",
        signatures_required: ["परिवार मुखिया (महिला)"],
        submission_point: "e-Mitra",
        official_pdf_link: "https://janaadhar.rajasthan.gov.in/",
        scheme_status: "ACTIVE"
      },
      {
        yojana_name: "प्रधानमंत्री किसान सम्मान निधि (PM-KISAN)",
        government: "Central Govt",
        category: "Agriculture",
        short_purpose_hindi: "किसान आय सहायता",
        detailed_benefits: "6000 रुपये प्रति वर्ष (2000 की 3 किस्तें)।",
        eligibility_criteria: ["कृषि योग्य भूमि वाले किसान"],
        eligibility_status: "CONDITIONAL",
        eligibility_reason_hindi: "यदि आप स्वयं किसान हैं और आपके नाम कृषि भूमि है।",
        required_documents: ["आधार कार्ड", "जमाबंदी (भूमि रिकॉर्ड)", "बैंक विवरण"],
        form_source: "PM-Kisan Portal",
        application_type: "Online",
        signatures_required: ["स्वयं"],
        submission_point: "Online / Patwari Verification",
        official_pdf_link: "https://pmkisan.gov.in/",
        scheme_status: "ACTIVE"
      },
      {
        yojana_name: "इंदिरा गांधी मातृत्व पोषण योजना (Rajasthan)",
        government: "Rajasthan Govt",
        category: "Women & Child",
        short_purpose_hindi: "गर्भवती महिलाओं को पोषण सहायता",
        detailed_benefits: "दूसरी संतान के जन्म पर 6000 रुपये की वित्तीय सहायता।",
        eligibility_criteria: ["राजस्थान की निवासी महिलाएं", "गर्भवती महिलाएं"],
        eligibility_status: "CONDITIONAL",
        eligibility_reason_hindi: "गर्भवती महिलाओं और दूसरी संतान के लिए उपलब्ध।",
        required_documents: ["ममता कार्ड", "आधार कार्ड", "बैंक पासबुक"],
        form_source: "Anganwadi Center",
        application_type: "Offline",
        signatures_required: ["स्वयं", "ANM/ASHA"],
        submission_point: "Anganwadi Center",
        official_pdf_link: "https://wcd.rajasthan.gov.in/",
        scheme_status: "ACTIVE"
      },
      {
        yojana_name: "मुख्यमंत्री अनुप्रति कोचिंग योजना (Rajasthan)",
        government: "Rajasthan Govt",
        category: "Education",
        short_purpose_hindi: "नि:शुल्क कोचिंग",
        detailed_benefits: "प्रतियोगी परीक्षाओं की तैयारी के लिए वित्तीय सहायता और कोचिंग।",
        eligibility_criteria: ["SC/ST/OBC/EWS/MBC के मेधावी छात्र", "आय 8 लाख से कम"],
        eligibility_status: "ELIGIBLE",
        eligibility_reason_hindi: "आपकी शैक्षणिक योग्यता और आय सीमा इसके अनुकूल है।",
        required_documents: ["मार्कशीट", "जाति प्रमाण पत्र", "आय प्रमाण पत्र"],
        form_source: "SJE Portal Rajasthan",
        application_type: "Online",
        signatures_required: ["स्वयं"],
        submission_point: "Online / SSO ID",
        official_pdf_link: "https://sje.rajasthan.gov.in/",
        scheme_status: "ACTIVE"
      },
      {
        yojana_name: "राजस्थान सामाजिक सुरक्षा पेंशन योजना (वृद्धावस्था/विधवा/दिव्यांग)",
        government: "Rajasthan Govt",
        category: "Pension",
        short_purpose_hindi: "मासिक आर्थिक सहायता",
        detailed_benefits: "1000 रुपये प्रति माह की पेंशन सहायता।",
        eligibility_criteria: ["वृद्ध (55+ महिला, 58+ पुरुष)", "विधवा", "दिव्यांग", "आय सीमा के भीतर"],
        eligibility_status: "CONDITIONAL",
        eligibility_reason_hindi: "उम्र या विशेष स्थिति (विधवा/दिव्यांग) के आधार पर देय।",
        required_documents: ["जन-आधार", "आधार", "आय प्रमाण पत्र", "आयु प्रमाण पत्र"],
        form_source: "Social Security Portal",
        application_type: "Online",
        signatures_required: ["स्वयं", "Tehsildar Verification"],
        submission_point: "e-Mitra / Block Office",
        official_pdf_link: "https://ssp.rajasthan.gov.in/",
        scheme_status: "ACTIVE"
      },
      {
        yojana_name: "कालीबाई भील मेधावी छात्रा स्कूटी योजना (Rajasthan)",
        government: "Rajasthan Govt",
        category: "Education/Women",
        short_purpose_hindi: "मेधावी छात्राओं को स्कूटी",
        detailed_benefits: "12वीं कक्षा में अच्छे अंक लाने वाली छात्राओं को नि:शुल्क स्कूटी।",
        eligibility_criteria: ["मेधावी छात्राएं", "निश्चित प्रतिशत अंक"],
        eligibility_status: "CONDITIONAL",
        eligibility_reason_hindi: "छात्राओं के लिए उनके शैक्षणिक प्रदर्शन के आधार पर।",
        required_documents: ["12वीं की मार्कशीट", "मूल निवास", "आधार"],
        form_source: "Higher Education Portal",
        application_type: "Online",
        signatures_required: ["स्वयं", "Principal"],
        submission_point: "Online Portal",
        official_pdf_link: "https://hteadmin.rajasthan.gov.in/",
        scheme_status: "ACTIVE"
      }
    ];
    
    // Using a simple loop to ensure all are put. IDB is async so we wait for tx completion if needed,
    // but put() is fine inside this seed method.
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
      req.onsuccess = () => {
        if (req.result) {
          resolve(req.result);
        } else {
          const backup = localStorage.getItem(`backup_${key}`);
          if (backup) {
            try {
              const parsed = JSON.parse(backup);
              this.setSetting(key, parsed);
              resolve(parsed);
            } catch(e) { resolve(null); }
          } else resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  }

  public async setSetting(key: string, value: any): Promise<void> {
    if (!this.db) await this.init();
    const tx = this.db!.transaction(SETTINGS_STORE, "readwrite");
    tx.objectStore(SETTINGS_STORE).put(value, key);
    localStorage.setItem(`backup_${key}`, JSON.stringify(value));
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
