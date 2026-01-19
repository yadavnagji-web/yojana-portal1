
import { Scheme, UserProfile, AnalysisResponse, CachedAnalysis } from "../types";

const DB_NAME = "SarkariYojanaMasterDB";
const DB_VERSION = 18; // Incremented version to ensure all clients get the new 20+ schemes
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
        eligibility_reason_hindi: "राजस्थान निवासियों के लिए सार्वभौमिक स्वास्थ्य कवरेज।",
        required_documents: ["जन-आधार कार्ड", "आधार कार्ड"],
        form_source: "Chiranjeevi Portal",
        application_type: "Online",
        signatures_required: ["स्वयं"],
        submission_point: "e-Mitra",
        official_pdf_link: "https://chiranjeevi.rajasthan.gov.in/",
        scheme_status: "ACTIVE"
      },
      {
        yojana_name: "अटल पेंशन योजना (APY)",
        government: "Central Govt",
        category: "Pension",
        short_purpose_hindi: "बुढ़ापे का सहारा",
        detailed_benefits: "1000 से 5000 रुपये तक की गारंटीड मासिक पेंशन।",
        eligibility_criteria: ["आयु 18-40 वर्ष", "आयकर दाता न हो"],
        eligibility_status: "ELIGIBLE",
        eligibility_reason_hindi: "असंगठित क्षेत्र के श्रमिकों के लिए सुरक्षित भविष्य।",
        required_documents: ["आधार", "बैंक पासबुक"],
        form_source: "बैंक",
        application_type: "Both",
        signatures_required: ["स्वयं"],
        submission_point: "बैंक शाखा",
        official_pdf_link: "#",
        scheme_status: "ACTIVE"
      },
      {
        yojana_name: "मुख्यमंत्री युवा संबल योजना (Rajasthan)",
        government: "Rajasthan Govt",
        category: "Employment",
        short_purpose_hindi: "बेरोजगारी भत्ता",
        detailed_benefits: "स्नातक युवाओं को 4000-4500 रुपये प्रति माह भत्ता।",
        eligibility_criteria: ["राजस्थान का स्नातक", "आय 2 लाख से कम", "बेरोजगार"],
        eligibility_status: "ELIGIBLE",
        eligibility_reason_hindi: "शिक्षित बेरोजगार युवाओं के लिए वित्तीय सहायता।",
        required_documents: ["डिग्री", "आय प्रमाण पत्र", "जन-आधार"],
        form_source: "Employment Portal",
        application_type: "Online",
        signatures_required: ["स्वयं"],
        submission_point: "SSO ID / Online",
        official_pdf_link: "#",
        scheme_status: "ACTIVE"
      },
      {
        yojana_name: "प्रधानमंत्री उज्ज्वला योजना (Ujjwala 2.0)",
        government: "Central Govt",
        category: "Energy",
        short_purpose_hindi: "नि:शुल्क गैस कनेक्शन",
        detailed_benefits: "गरीब परिवारों की महिलाओं को नि:शुल्क एलपीजी कनेक्शन।",
        eligibility_criteria: ["महिला मुखिया", "BPL/Antyodaya परिवार"],
        eligibility_status: "ELIGIBLE",
        eligibility_reason_hindi: "ग्रामीण और गरीब परिवारों के लिए स्वच्छ ईंधन।",
        required_documents: ["BPL कार्ड", "आधार", "बैंक खाता"],
        form_source: "Gas Agency",
        application_type: "Both",
        signatures_required: ["स्वयं"],
        submission_point: "निकटतम गैस एजेंसी",
        official_pdf_link: "https://www.pmuy.gov.in/",
        scheme_status: "ACTIVE"
      },
      {
        yojana_name: "सुकन्या समृद्धि योजना",
        government: "Central Govt",
        category: "Women & Child",
        short_purpose_hindi: "बेटी का भविष्य",
        detailed_benefits: "बालिकाओं के लिए उच्च ब्याज दर वाला बचत खाता।",
        eligibility_criteria: ["10 वर्ष से कम आयु की बालिका"],
        eligibility_status: "CONDITIONAL",
        eligibility_reason_hindi: "बेटियों की शिक्षा और विवाह हेतु सुरक्षित निवेश।",
        required_documents: ["जन्म प्रमाण पत्र", "माता-पिता का आधार"],
        form_source: "Post Office / Bank",
        application_type: "Offline",
        signatures_required: ["अभिभावक"],
        submission_point: "डाकघर / बैंक",
        official_pdf_link: "#",
        scheme_status: "ACTIVE"
      },
      {
        yojana_name: "राजस्थान महिला निधि योजना",
        government: "Rajasthan Govt",
        category: "Women Empowerment",
        short_purpose_hindi: "आसान ऋण",
        detailed_benefits: "महिला स्वयं सहायता समूहों को व्यवसाय हेतु ऋण।",
        eligibility_criteria: ["SHG सदस्य", "राजस्थान निवासी महिला"],
        eligibility_status: "CONDITIONAL",
        eligibility_reason_hindi: "महिला उद्यमिता को बढ़ावा देने हेतु।",
        required_documents: ["SHG विवरण", "आधार", "बैंक पासबुक"],
        form_source: "Rajeevika",
        application_type: "Both",
        signatures_required: ["स्वयं", "समूह अध्यक्ष"],
        submission_point: "राजीविका कार्यालय",
        official_pdf_link: "#",
        scheme_status: "ACTIVE"
      },
      {
        yojana_name: "प्रधानमंत्री आवास योजना (ग्रामीण)",
        government: "Central Govt",
        category: "Housing",
        short_purpose_hindi: "पक्का घर",
        detailed_benefits: "घर बनाने हेतु 1.20 लाख रुपये की सहायता।",
        eligibility_criteria: ["कच्चा मकान", "बेघर परिवार", "SECC 2011 सूची"],
        eligibility_status: "CONDITIONAL",
        eligibility_reason_hindi: "सभी के लिए अपना पक्का आवास सुनिश्चित करना।",
        required_documents: ["आधार", "बैंक विवरण", "जमीन के कागज़"],
        form_source: "Gram Panchayat",
        application_type: "Offline",
        signatures_required: ["स्वयं", "Sarpanch"],
        submission_point: "ग्राम पंचायत",
        official_pdf_link: "#",
        scheme_status: "ACTIVE"
      },
      {
        yojana_name: "आयुष्मान भारत (PM-JAY)",
        government: "Central Govt",
        category: "Health",
        short_purpose_hindi: "5 लाख का स्वास्थ्य बीमा",
        detailed_benefits: "चिह्नित अस्पतालों में 5 लाख तक का नि:शुल्क इलाज।",
        eligibility_criteria: ["SECC 2011 में नाम", "NFSA लाभार्थी"],
        eligibility_status: "ELIGIBLE",
        eligibility_reason_hindi: "गरीब परिवारों के लिए राष्ट्रीय स्वास्थ्य सुरक्षा।",
        required_documents: ["राशन कार्ड", "आधार"],
        form_source: "CSC / Hospitals",
        application_type: "Online",
        signatures_required: ["स्वयं"],
        submission_point: "Common Service Center",
        official_pdf_link: "https://pmjay.gov.in/",
        scheme_status: "ACTIVE"
      },
      {
        yojana_name: "राजस्थान इंदिरा गांधी शहरी क्रेडिट कार्ड योजना",
        government: "Rajasthan Govt",
        category: "Economic",
        short_purpose_hindi: "ब्याज मुक्त ऋण",
        detailed_benefits: "स्ट्रीट वेंडर्स और सेवा क्षेत्र के युवाओं को 50,000 तक ऋण।",
        eligibility_criteria: ["शहरी निवासी", "आयु 18-40 वर्ष"],
        eligibility_status: "CONDITIONAL",
        eligibility_reason_hindi: "छोटे व्यापारियों के लिए कार्यशील पूंजी सहायता।",
        required_documents: ["आधार", "व्यवसाय प्रमाण", "शहरी निवास"],
        form_source: "ULB Portal",
        application_type: "Online",
        signatures_required: ["स्वयं"],
        submission_point: "Online / Municipal Office",
        official_pdf_link: "#",
        scheme_status: "ACTIVE"
      },
      {
        yojana_name: "प्रधानमंत्री सुरक्षा बीमा योजना (PMSBY)",
        government: "Central Govt",
        category: "Insurance",
        short_purpose_hindi: "दुर्घटना बीमा",
        detailed_benefits: "2 लाख रुपये का दुर्घटना मृत्यु/दिव्यांगता बीमा (20रु/वर्ष)।",
        eligibility_criteria: ["आयु 18-70 वर्ष", "बैंक खाता"],
        eligibility_status: "ELIGIBLE",
        eligibility_reason_hindi: "किफायती दुर्घटना सुरक्षा।",
        required_documents: ["बैंक पासबुक", "आधार"],
        form_source: "बैंक",
        application_type: "Offline",
        signatures_required: ["स्वयं"],
        submission_point: "बैंक",
        official_pdf_link: "#",
        scheme_status: "ACTIVE"
      },
      {
        yojana_name: "प्रधानमंत्री जीवन ज्योति बीमा योजना (PMJJBY)",
        government: "Central Govt",
        category: "Insurance",
        short_purpose_hindi: "जीवन बीमा",
        detailed_benefits: "2 लाख रुपये का जीवन बीमा (436रु/वर्ष)।",
        eligibility_criteria: ["आयु 18-50 वर्ष", "बैंक खाता"],
        eligibility_status: "ELIGIBLE",
        eligibility_reason_hindi: "किसी भी कारण से मृत्यु होने पर परिवार को सुरक्षा।",
        required_documents: ["बैंक पासबुक", "आधार"],
        form_source: "बैंक",
        application_type: "Offline",
        signatures_required: ["स्वयं"],
        submission_point: "बैंक",
        official_pdf_link: "#",
        scheme_status: "ACTIVE"
      },
      {
        yojana_name: "मुख्यमंत्री राजश्री योजना (Rajasthan)",
        government: "Rajasthan Govt",
        category: "Women & Child",
        short_purpose_hindi: "बालिका प्रोत्साहन",
        detailed_benefits: "बालिका के जन्म से 12वीं तक कुल 50,000 रुपये की सहायता।",
        eligibility_criteria: ["राजस्थान की निवासी बालिका", "राजकीय चिकित्सालय में जन्म"],
        eligibility_status: "CONDITIONAL",
        eligibility_reason_hindi: "बेटियों की शिक्षा और स्वास्थ्य सुनिश्चित करने हेतु।",
        required_documents: ["जन्म प्रमाण पत्र", "ममता कार्ड", "जन-आधार"],
        form_source: "Medical Institution / School",
        application_type: "Offline",
        signatures_required: ["अभिभावक"],
        submission_point: "सरकारी स्कूल / अस्पताल",
        official_pdf_link: "#",
        scheme_status: "ACTIVE"
      },
      {
        yojana_name: "पीएम स्वनिधि (PM SVANidhi)",
        government: "Central Govt",
        category: "Economic",
        short_purpose_hindi: "रेहड़ी-पटरी ऋण",
        detailed_benefits: "स्ट्रीट वेंडर्स को 10,000 से 50,000 तक का कार्यशील पूंजी ऋण।",
        eligibility_criteria: ["स्ट्रीट वेंडर", "शहरी क्षेत्र"],
        eligibility_status: "CONDITIONAL",
        eligibility_reason_hindi: "बिना किसी गारंटी के ऋण सहायता।",
        required_documents: ["आधार", "वेंडिंग प्रमाण पत्र"],
        form_source: "PMSVANidhi Portal",
        application_type: "Online",
        signatures_required: ["स्वयं"],
        submission_point: "e-Mitra / CSC",
        official_pdf_link: "https://pmsvanidhi.mohua.gov.in/",
        scheme_status: "ACTIVE"
      },
      {
        yojana_name: "मुख्यमंत्री कन्यादान योजना (Rajasthan)",
        government: "Rajasthan Govt",
        category: "Social Security",
        short_purpose_hindi: "विवाह सहायता",
        detailed_benefits: "SC/ST/BPL परिवारों की बेटियों के विवाह पर 31,000-51,000 की सहायता।",
        eligibility_criteria: ["BPL/SC/ST परिवार", "राजस्थान निवासी"],
        eligibility_status: "CONDITIONAL",
        eligibility_reason_hindi: "निर्धन परिवारों की बेटियों के विवाह हेतु आर्थिक मदद।",
        required_documents: ["विवाह प्रमाण पत्र", "BPL कार्ड", "जन-आधार"],
        form_source: "SJE Portal",
        application_type: "Online",
        signatures_required: ["स्वयं"],
        submission_point: "SSO ID / Online",
        official_pdf_link: "#",
        scheme_status: "ACTIVE"
      },
      {
        yojana_name: "मध्याह्न भोजन योजना (Mid Day Meal)",
        government: "Central Govt",
        category: "Education",
        short_purpose_hindi: "नि:शुल्क भोजन",
        detailed_benefits: "सरकारी स्कूलों के छात्रों को पौष्टिक गर्म पका हुआ भोजन।",
        eligibility_criteria: ["कक्षा 1-8 के छात्र", "राजकीय विद्यालय"],
        eligibility_status: "ELIGIBLE",
        eligibility_reason_hindi: "छात्रों के नामांकन और पोषण में सुधार हेतु।",
        required_documents: ["स्कूल नामांकन"],
        form_source: "School",
        application_type: "Automatic",
        signatures_required: ["N/A"],
        submission_point: "विद्यालय",
        official_pdf_link: "#",
        scheme_status: "ACTIVE"
      },
      {
        yojana_name: "जननी सुरक्षा योजना (JSY)",
        government: "Central Govt",
        category: "Health",
        short_purpose_hindi: "सुरक्षित प्रसव",
        detailed_benefits: "सरकारी संस्थान में प्रसव होने पर नकद वित्तीय सहायता।",
        eligibility_criteria: ["गर्भवती महिलाएं", "संस्थागत प्रसव"],
        eligibility_status: "CONDITIONAL",
        eligibility_reason_hindi: "मातृ और शिशु मृत्यु दर को कम करने हेतु।",
        required_documents: ["ममता कार्ड", "आधार", "बैंक पासबुक"],
        form_source: "Govt Hospital",
        application_type: "Offline",
        signatures_required: ["स्वयं", "ANM"],
        submission_point: "सरकारी अस्पताल",
        official_pdf_link: "#",
        scheme_status: "ACTIVE"
      },
      {
        yojana_name: "पीएम मुद्रा योजना",
        government: "Central Govt",
        category: "Economic",
        short_purpose_hindi: "व्यापार ऋण",
        detailed_benefits: "गैर-कॉर्पोरेट व्यवसाय हेतु 50,000 से 10 लाख तक का ऋण।",
        eligibility_criteria: ["व्यवसाय शुरू करने के इच्छुक"],
        eligibility_status: "CONDITIONAL",
        eligibility_reason_hindi: "लघु व्यवसायों के वित्तपोषण हेतु।",
        required_documents: ["आधार", "पैन", "व्यापार योजना"],
        form_source: "Bank",
        application_type: "Offline",
        signatures_required: ["स्वयं"],
        submission_point: "बैंक",
        official_pdf_link: "https://www.mudra.org.in/",
        scheme_status: "ACTIVE"
      },
      {
        yojana_name: "स्टैंड अप इंडिया",
        government: "Central Govt",
        category: "Economic",
        short_purpose_hindi: "उद्यमिता ऋण",
        detailed_benefits: "महिला/SC/ST उद्यमियों को 10 लाख से 1 करोड़ तक का ऋण।",
        eligibility_criteria: ["महिला उद्यमी", "SC/ST उद्यमी"],
        eligibility_status: "CONDITIONAL",
        eligibility_reason_hindi: "नए ग्रीनफील्ड उद्यमों की स्थापना हेतु।",
        required_documents: ["आधार", "परियोजना रिपोर्ट", "पैन"],
        form_source: "Bank / StandUp Portal",
        application_type: "Both",
        signatures_required: ["स्वयं"],
        submission_point: "बैंक",
        official_pdf_link: "https://www.standupmitra.in/",
        scheme_status: "ACTIVE"
      },
      {
        yojana_name: "देवनारायण छात्रा स्कूटी योजना (Rajasthan)",
        government: "Rajasthan Govt",
        category: "Education/Women",
        short_purpose_hindi: "मेधावी छात्राओं को स्कूटी",
        detailed_benefits: "MBC वर्ग की मेधावी छात्राओं को स्कूटी और प्रोत्साहन राशि।",
        eligibility_criteria: ["MBC वर्ग", "12वीं में अच्छे अंक", "आय 2.5 लाख से कम"],
        eligibility_status: "CONDITIONAL",
        eligibility_reason_hindi: "अति पिछड़ा वर्ग की छात्राओं के सशक्तिकरण हेतु।",
        required_documents: ["मार्कशीट", "जाति प्रमाण", "आय प्रमाण"],
        form_source: "Higher Education Portal",
        application_type: "Online",
        signatures_required: ["स्वयं"],
        submission_point: "Online Portal",
        official_pdf_link: "#",
        scheme_status: "ACTIVE"
      },
      {
        yojana_name: "राजस्थान सिलीकोसिस नीति",
        government: "Rajasthan Govt",
        category: "Health/Social",
        short_purpose_hindi: "सिलीकोसिस पीड़ित सहायता",
        detailed_benefits: "पीड़ित को 3 लाख और मृत्यु पर परिवार को 2 लाख की सहायता।",
        eligibility_criteria: ["सिलीकोसिस बीमारी से प्रमाणित पीड़ित"],
        eligibility_status: "CONDITIONAL",
        eligibility_reason_hindi: "खदानों में काम करने वाले श्रमिकों की सुरक्षा हेतु।",
        required_documents: ["मेडिकल बोर्ड प्रमाण पत्र", "जन-आधार"],
        form_source: "SJE Portal",
        application_type: "Online",
        signatures_required: ["स्वयं"],
        submission_point: "SSO ID / e-Mitra",
        official_pdf_link: "#",
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
