
import { Scheme, UserProfile, AnalysisResponse, CachedAnalysis } from "../types";

const DB_NAME = "SarkariYojanaMasterDB";
const DB_VERSION = 25; // Version bump for massive data update
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
        await this.seedMasterData();
        resolve(); 
      };
      request.onerror = (e) => reject((e.target as IDBOpenDBRequest).error);
    });

    return this.initPromise;
  }

  private async seedMasterData(): Promise<void> {
    const MASTER_SCHEMES: Scheme[] = [
      // --- RAJASTHAN STATE SCHEMES (AUTHENTIC) ---
      {
        yojana_name: "मुख्यमंत्री आयुष्मान आरोग्य योजना (MAAY)",
        government: "Rajasthan Govt",
        category: "Health",
        short_purpose_hindi: "नि:शुल्क इलाज",
        detailed_benefits: "25 लाख रुपये तक का कैशलेस स्वास्थ्य बीमा। यह चिरंजीवी योजना का नया स्वरूप है।",
        eligibility_criteria: ["राजस्थान का मूल निवासी", "जन-आधार कार्ड", "NFSA/BPL या निर्धारित प्रीमियम भुगतान"],
        eligibility_status: "ELIGIBLE",
        eligibility_reason_hindi: "राजस्थान के निवासियों के लिए सबसे बड़ी स्वास्थ्य सुरक्षा योजना।",
        required_documents: ["जन-आधार कार्ड", "आधार कार्ड", "राशन कार्ड"],
        form_source: "Ayushman Bharat Portal",
        application_type: "Online",
        signatures_required: ["स्वयं"],
        submission_point: "ई-मित्र (e-Mitra)",
        official_pdf_link: "https://health.rajasthan.gov.in/",
        scheme_status: "ACTIVE"
      },
      {
        yojana_name: "पालनहार योजना (Rajasthan)",
        government: "Rajasthan Govt",
        category: "Social Security",
        short_purpose_hindi: "अनाथ/असहाय बच्चों हेतु सहायता",
        detailed_benefits: "0-6 वर्ष के बच्चों को 750रु और 6-18 वर्ष के बच्चों को 1500रु प्रति माह।",
        eligibility_criteria: ["अनाथ बच्चे", "न्यायिक कारावास काट रहे माता-पिता के बच्चे", "विकलांग माता-पिता के बच्चे", "आय 1.20 लाख से कम"],
        eligibility_status: "CONDITIONAL",
        eligibility_reason_hindi: "समाज के सबसे वंचित वर्ग के बच्चों की शिक्षा और पालन-पोषण हेतु।",
        required_documents: ["मृत्यु प्रमाण पत्र/पात्रता प्रमाण", "जन-आधार", "आय प्रमाण पत्र", "स्कूल प्रमाण पत्र"],
        form_source: "SJE Portal",
        application_type: "Online",
        signatures_required: ["पालनहार", "संस्था प्रधान (School)"],
        submission_point: "e-Mitra / SSO Portal",
        official_pdf_link: "https://sje.rajasthan.gov.in/",
        scheme_status: "ACTIVE"
      },
      {
        yojana_name: "मुख्यमंत्री अनुप्रति कोचिंग योजना",
        government: "Rajasthan Govt",
        category: "Education",
        short_purpose_hindi: "नि:शुल्क कोचिंग",
        detailed_benefits: "प्रतियोगी परीक्षाओं (IAS, RAS, REET, NEET, IIT) की तैयारी हेतु नि:शुल्क कोचिंग और आवास भत्ता।",
        eligibility_criteria: ["SC/ST/OBC/MBC/EWS/Minority", "आय 8 लाख से कम", "10वीं/12वीं के अंक आधारित"],
        eligibility_status: "CONDITIONAL",
        eligibility_reason_hindi: "प्रतिभाशाली छात्रों को बिना आर्थिक बाधा के उच्च शिक्षा हेतु।",
        required_documents: ["मार्कशीट", "जाति प्रमाण पत्र", "आय प्रमाण पत्र", "जन-आधार"],
        form_source: "SJE SSO Portal",
        application_type: "Online",
        signatures_required: ["स्वयं"],
        submission_point: "Online via SSO ID",
        official_pdf_link: "https://sje.rajasthan.gov.in/",
        scheme_status: "ACTIVE"
      },
      {
        yojana_name: "कालीबाई भील मेधावी छात्रा स्कूटी योजना",
        government: "Rajasthan Govt",
        category: "Education/Women",
        short_purpose_hindi: "छात्राओं को स्कूटी",
        detailed_benefits: "12वीं कक्षा में उत्कृष्ट अंक लाने वाली छात्राओं को नि:शुल्क स्कूटी।",
        eligibility_criteria: ["राजस्थान की छात्रा", "SC/ST/OBC/EWS/Minority", "RBSE में 65% या CBSE में 75% अंक"],
        eligibility_status: "CONDITIONAL",
        eligibility_reason_hindi: "बालिका शिक्षा को प्रोत्साहित करने और उच्च शिक्षा तक पहुँच बढ़ाने हेतु।",
        required_documents: ["12वीं की मार्कशीट", "जन-आधार", "नियमित अध्ययन प्रमाण पत्र"],
        form_source: "Higher Education Portal",
        application_type: "Online",
        signatures_required: ["स्वयं", "प्रधानाचार्य"],
        submission_point: "HTE Portal",
        official_pdf_link: "#",
        scheme_status: "ACTIVE"
      },
      {
        yojana_name: "राजस्थान सामाजिक सुरक्षा पेंशन (वृद्धावस्था)",
        government: "Rajasthan Govt",
        category: "Pension",
        short_purpose_hindi: "बुजुर्गों हेतु मासिक पेंशन",
        detailed_benefits: "75 वर्ष से कम आयु को 1150रु प्रति माह। (राशि हाल ही में बढ़ाई गई है)।",
        eligibility_criteria: ["महिला आयु 55+", "पुरुष आयु 58+", "आय 48,000 से कम"],
        eligibility_status: "ELIGIBLE",
        eligibility_reason_hindi: "बुजुर्गों के सम्मानजनक जीवन हेतु वित्तीय सहायता।",
        required_documents: ["जन-आधार", "आधार", "बैंक पासबुक"],
        form_source: "SJE Portal",
        application_type: "Online",
        signatures_required: ["स्वयं", "Patwari (Verifying)"],
        submission_point: "ई-मित्र / पंचायत",
        official_pdf_link: "https://rajssp.raj.nic.in/",
        scheme_status: "ACTIVE"
      },
      {
        yojana_name: "इन्दिरा रसोई योजना (अब श्री अन्नपूर्णा रसोई)",
        government: "Rajasthan Govt",
        category: "Food",
        short_purpose_hindi: "सस्ता और पौष्टिक भोजन",
        detailed_benefits: "मात्र 8 रुपये में शुद्ध और पौष्टिक भरपेट भोजन।",
        eligibility_criteria: ["कोई भी व्यक्ति"],
        eligibility_status: "ELIGIBLE",
        eligibility_reason_hindi: "कोई भी भूखा न सोए संकल्प के साथ।",
        required_documents: ["पहचान पत्र (वैकल्पिक)"],
        form_source: "N/A",
        application_type: "Automatic",
        signatures_required: ["N/A"],
        submission_point: "रसोई केंद्र",
        official_pdf_link: "#",
        scheme_status: "ACTIVE"
      },

      // --- CENTRAL GOVERNMENT SCHEMES (AUTHENTIC) ---
      {
        yojana_name: "पीएम सूर्य घर मुफ्त बिजली योजना",
        government: "Central Govt",
        category: "Energy",
        short_purpose_hindi: "नि:शुल्क सोलर बिजली",
        detailed_benefits: "छत पर सोलर पैनल लगाने हेतु 78,000 रुपये तक की सब्सिडी और 300 यूनिट मुफ्त बिजली।",
        eligibility_criteria: ["स्वयं का पक्का मकान", "बिजली कनेक्शन", "पर्याप्त छत स्थान"],
        eligibility_status: "CONDITIONAL",
        eligibility_reason_hindi: "पर्यावरण अनुकूल ऊर्जा और बिजली बिल से मुक्ति।",
        required_documents: ["आधार", "बिजली का बिल", "जमीन के कागज़/छत का फोटो", "बैंक खाता"],
        form_source: "National Portal for Rooftop Solar",
        application_type: "Online",
        signatures_required: ["स्वयं"],
        submission_point: "pmsuryaghar.gov.in",
        official_pdf_link: "https://pmsuryaghar.gov.in/",
        scheme_status: "ACTIVE"
      },
      {
        yojana_name: "प्रधानमंत्री विश्वकर्मा योजना",
        government: "Central Govt",
        category: "Employment/Skill",
        short_purpose_hindi: "पारंपरिक कारीगरों हेतु सहायता",
        detailed_benefits: "15,000 रुपये टूलकिट अनुदान, ट्रेनिंग के दौरान 500रु/दिन स्टाइपेंड और 3 लाख तक का सस्ता ऋण।",
        eligibility_criteria: ["18 पारंपरिक व्यापार (लोहार, कुम्हार, राजमिस्त्री आदि)", "परिवार में एक लाभार्थी", "सरकारी सेवा में न हो"],
        eligibility_status: "CONDITIONAL",
        eligibility_reason_hindi: "पारंपरिक कौशल को पुनर्जीवित करने और कारीगरों को सशक्त बनाने हेतु।",
        required_documents: ["आधार", "बैंक विवरण", "राशन कार्ड", "मोबाइल नंबर"],
        form_source: "PM Vishwakarma Portal",
        application_type: "Online",
        signatures_required: ["स्वयं", "Gram Pradhan"],
        submission_point: "CSC / Common Service Center",
        official_pdf_link: "https://pmvishwakarma.gov.in/",
        scheme_status: "ACTIVE"
      },
      {
        yojana_name: "लखपति दीदी योजना",
        government: "Central Govt",
        category: "Women Empowerment",
        short_purpose_hindi: "महिलाओं की आय बढ़ाना",
        detailed_benefits: "स्वयं सहायता समूह की महिलाओं को कौशल प्रशिक्षण और 1 लाख रुपये वार्षिक आय सुनिश्चित करने हेतु सहायता।",
        eligibility_criteria: ["SHG सदस्य महिला", "ग्रामीण क्षेत्र"],
        eligibility_status: "CONDITIONAL",
        eligibility_reason_hindi: "महिलाओं को उद्यमी बनाने हेतु सरकार का बड़ा कदम।",
        required_documents: ["SHG सदस्यता प्रमाण", "आधार", "बैंक पासबुक"],
        form_source: "NRLM Office",
        application_type: "Offline",
        signatures_required: ["स्वयं", "SHG अध्यक्ष"],
        submission_point: "Block Development Office (BDO)",
        official_pdf_link: "#",
        scheme_status: "ACTIVE"
      },
      {
        yojana_name: "प्रधानमंत्री किसान सम्मान निधि (PM-KISAN)",
        government: "Central Govt",
        category: "Agriculture",
        short_purpose_hindi: "किसानों को नकद सहायता",
        detailed_benefits: "सालाना 6000 रुपये (2000 की 3 किस्तें) सीधे बैंक खाते में।",
        eligibility_criteria: ["खेती योग्य भूमि", "सरकारी नौकरी/आयकर दाता न हो"],
        eligibility_status: "ELIGIBLE",
        eligibility_reason_hindi: "किसानों की कृषि इनपुट लागत में सहायता हेतु।",
        required_documents: ["आधार", "जमीन की जमाबंदी (Land Records)", "बैंक खाता"],
        form_source: "PM Kisan Portal",
        application_type: "Online",
        signatures_required: ["स्वयं"],
        submission_point: "Online / CSC",
        official_pdf_link: "https://pmkisan.gov.in/",
        scheme_status: "ACTIVE"
      },
      {
        yojana_name: "प्रधानमंत्री मातृ वंदना योजना (PMMVY)",
        government: "Central Govt",
        category: "Women & Child",
        short_purpose_hindi: "गर्भवती महिलाओं हेतु सहायता",
        detailed_benefits: "पहले बच्चे के जन्म पर 5000 रुपये की नकद सहायता (दो किस्तों में)।",
        eligibility_criteria: ["गर्भवती और स्तनपान कराने वाली महिलाएं", "सरकारी कर्मचारी न हो"],
        eligibility_status: "CONDITIONAL",
        eligibility_reason_hindi: "गर्भावस्था के दौरान मजदूरी के नुकसान की भरपाई और पोषण हेतु।",
        required_documents: ["ममता कार्ड (MCP Card)", "आधार", "बैंक खाता"],
        form_source: "Anganwadi Center",
        application_type: "Offline",
        signatures_required: ["स्वयं", "पति (वैकल्पिक)", "ASHA/ANM"],
        submission_point: "आंगनवाड़ी केंद्र",
        official_pdf_link: "https://pmmvy.nic.in/",
        scheme_status: "ACTIVE"
      },
      {
        yojana_name: "प्रधानमंत्री आवास योजना (PMAY-G)",
        government: "Central Govt",
        category: "Housing",
        short_purpose_hindi: "पक्का घर बनाने हेतु सहायता",
        detailed_benefits: "मैदानी क्षेत्रों में 1.20 लाख और पहाड़ी क्षेत्रों में 1.30 लाख रुपये की सहायता।",
        eligibility_criteria: ["बेघर परिवार", "कच्चा/जीर्ण-शीर्ण मकान", "SECC 2011/आवास+ सूची में नाम"],
        eligibility_status: "CONDITIONAL",
        eligibility_reason_hindi: "सभी को सर छुपाने के लिए पक्की छत प्रदान करना।",
        required_documents: ["आधार", "बैंक विवरण", "जमीन के दस्तावेज", "जॉब कार्ड"],
        form_source: "Gram Panchayat",
        application_type: "Offline",
        signatures_required: ["स्वयं", "Sarpanch"],
        submission_point: "ग्राम पंचायत",
        official_pdf_link: "https://pmayg.nic.in/",
        scheme_status: "ACTIVE"
      },
      {
        yojana_name: "अटल पेंशन योजना (APY)",
        government: "Central Govt",
        category: "Pension",
        short_purpose_hindi: "बुढ़ापे की नियमित पेंशन",
        detailed_benefits: "60 वर्ष की आयु के बाद 1000 से 5000 रुपये तक की गारंटीड पेंशन।",
        eligibility_criteria: ["आयु 18-40 वर्ष", "आयकर दाता न हो", "बैंक खाता अनिवार्य"],
        eligibility_status: "ELIGIBLE",
        eligibility_reason_hindi: "असंगठित क्षेत्र के श्रमिकों के लिए बुढ़ापे का सहारा।",
        required_documents: ["आधार", "बैंक पासबुक"],
        form_source: "बैंक शाखा",
        application_type: "Both",
        signatures_required: ["स्वयं"],
        submission_point: "अपनी बैंक शाखा",
        official_pdf_link: "#",
        scheme_status: "ACTIVE"
      },
      {
        yojana_name: "प्रधानमंत्री जन-धन योजना (PMJDY)",
        government: "Central Govt",
        category: "Banking",
        short_purpose_hindi: "शून्य बैलेंस बैंक खाता",
        detailed_benefits: "जीरो बैलेंस खाता, 2 लाख का दुर्घटना बीमा, 10,000 रुपये ओवरड्राफ्ट सुविधा।",
        eligibility_criteria: ["कोई भी भारतीय नागरिक"],
        eligibility_status: "ELIGIBLE",
        eligibility_reason_hindi: "वित्तीय समावेशन और सरकारी लाभों की सीधी पहुँच।",
        required_documents: ["आधार", "फोटो"],
        form_source: "Any Bank",
        application_type: "Offline",
        signatures_required: ["स्वयं"],
        submission_point: "बैंक",
        official_pdf_link: "https://pmjdy.gov.in/",
        scheme_status: "ACTIVE"
      },
      {
        yojana_name: "सुकन्या समृद्धि योजना (SSY)",
        government: "Central Govt",
        category: "Women & Child",
        short_purpose_hindi: "बेटी की पढ़ाई और शादी हेतु बचत",
        detailed_benefits: "बालिका के नाम पर उच्च ब्याज दर वाला खाता, आयकर में छूट।",
        eligibility_criteria: ["10 वर्ष से कम आयु की बालिका", "अधिकतम 2 बेटियाँ"],
        eligibility_status: "CONDITIONAL",
        eligibility_reason_hindi: "बेटियों के सुनहरे भविष्य के लिए सुरक्षित निवेश।",
        required_documents: ["बालिका का जन्म प्रमाण पत्र", "माता-पिता का आधार", "बैंक/डाकघर फॉर्म"],
        form_source: "Post Office / Bank",
        application_type: "Offline",
        signatures_required: ["अभिभावक"],
        submission_point: "डाकघर / बैंक",
        official_pdf_link: "#",
        scheme_status: "ACTIVE"
      },
      {
        yojana_name: "प्रधानमंत्री उज्ज्वला योजना (Ujjwala 2.0)",
        government: "Central Govt",
        category: "Energy",
        short_purpose_hindi: "नि:शुल्क गैस कनेक्शन",
        detailed_benefits: "बीपीएल परिवारों को नि:शुल्क एलपीजी कनेक्शन और पहला रिफिल व चूल्हा मुफ्त।",
        eligibility_criteria: ["महिला मुखिया", "BPL/Antyodaya/SECC श्रेणी", "घर में पहले से कनेक्शन न हो"],
        eligibility_status: "ELIGIBLE",
        eligibility_reason_hindi: "स्वच्छ ईंधन और धुआं मुक्त रसोई।",
        required_documents: ["BPL कार्ड", "आधार", "राशन कार्ड", "बैंक खाता"],
        form_source: "Gas Agency",
        application_type: "Both",
        signatures_required: ["स्वयं"],
        submission_point: "निकटतम गैस एजेंसी",
        official_pdf_link: "https://www.pmuy.gov.in/",
        scheme_status: "ACTIVE"
      },
      {
        yojana_name: "प्रधानमंत्री श्रम योगी मान-धन (PM-SYM)",
        government: "Central Govt",
        category: "Pension",
        short_purpose_hindi: "श्रमिकों हेतु पेंशन",
        detailed_benefits: "60 वर्ष के बाद 3000 रुपये मासिक पेंशन।",
        eligibility_criteria: ["आयु 18-40", "मासिक आय 15,000 से कम", "असंगठित क्षेत्र के श्रमिक"],
        eligibility_status: "ELIGIBLE",
        eligibility_reason_hindi: "दिहाड़ी मजदूरों और कामगारों के लिए सामाजिक सुरक्षा।",
        required_documents: ["आधार", "बैंक पासबुक", "मोबाइल नंबर"],
        form_source: "CSC Portal",
        application_type: "Online",
        signatures_required: ["स्वयं"],
        submission_point: "Common Service Center (CSC)",
        official_pdf_link: "https://maandhan.in/",
        scheme_status: "ACTIVE"
      },
      {
        yojana_name: "पीएम जनमन (PM-JANMAN)",
        government: "Central Govt",
        category: "Tribal Welfare",
        short_purpose_hindi: "आदिवासी समूहों का विकास",
        detailed_benefits: "विशेष रूप से कमजोर जनजातीय समूहों (PVTG) को घर, सड़क, पानी और इंटरनेट जैसी बुनियादी सुविधाएं।",
        eligibility_criteria: ["PVTG समुदाय का सदस्य"],
        eligibility_status: "CONDITIONAL",
        eligibility_reason_hindi: "सबसे पिछड़े जनजातीय समुदायों के उत्थान हेतु।",
        required_documents: ["जाति प्रमाण पत्र", "आधार", "जन-आधार (राजस्थान हेतु)"],
        form_source: "District Tribal Office",
        application_type: "Both",
        signatures_required: ["स्वयं"],
        submission_point: "पंचायत / जिला कार्यालय",
        official_pdf_link: "#",
        scheme_status: "ACTIVE"
      }
    ];
    
    // Seed database
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
