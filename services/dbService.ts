
import { Scheme, UserProfile, AnalysisResponse, CachedAnalysis } from "../types";

const DB_NAME = "SarkariYojanaMasterDB";
const DB_VERSION = 16; 
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

      // Attempt to request persistent storage (to prevent browser cleaning)
      if (navigator.storage && navigator.storage.persist) {
        navigator.storage.persist().then(persistent => {
          if (persistent) console.debug("Storage will not be cleared by the browser.");
          else console.debug("Storage may be cleared under pressure.");
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
        
        // Handle database being closed by browser/external factors
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
    // Basic Schemes included in the JS bundle to ensure it always works
    const MASTER_SCHEMES: Scheme[] = [
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
      }
    ];
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
    // Extra safety: Multi-layer storage
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
