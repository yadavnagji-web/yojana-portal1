
import { Scheme, UserProfile, AnalysisResponse, CachedAnalysis } from "../types";

const DB_NAME = "SarkariYojanaMasterDB";
const DB_VERSION = 11; // Incremented to ensure fresh stores and fix keyPath issues
const SCHEME_STORE = "schemes";
const SETTINGS_STORE = "settings";
const CACHE_STORE = "analysis_cache";
const USER_RECORDS_STORE = "user_submissions";

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
        
        // Re-create stores if they exist but might have incorrect keyPath configuration from older versions
        if (db.objectStoreNames.contains(SCHEME_STORE)) db.deleteObjectStore(SCHEME_STORE);
        db.createObjectStore(SCHEME_STORE, { keyPath: "yojana_name" });

        if (db.objectStoreNames.contains(SETTINGS_STORE)) db.deleteObjectStore(SETTINGS_STORE);
        db.createObjectStore(SETTINGS_STORE); // Out-of-line keys

        if (db.objectStoreNames.contains(CACHE_STORE)) db.deleteObjectStore(CACHE_STORE);
        db.createObjectStore(CACHE_STORE, { keyPath: "profileHash" });

        if (db.objectStoreNames.contains(USER_RECORDS_STORE)) db.deleteObjectStore(USER_RECORDS_STORE);
        db.createObjectStore(USER_RECORDS_STORE, { autoIncrement: true });
      };

      request.onsuccess = (e) => { 
        this.db = (e.target as IDBOpenDBRequest).result; 
        resolve(); 
      };
      request.onerror = (e) => reject((e.target as IDBOpenDBRequest).error);
    });
  }

  public async saveCache(hash: string, response: AnalysisResponse): Promise<void> {
    if (!this.db) await this.init();
    if (!hash) return;
    const tx = this.db!.transaction(CACHE_STORE, "readwrite");
    const data = { 
      profileHash: hash, // This MUST exist because it is the keyPath
      response, 
      timestamp: Date.now() 
    };
    tx.objectStore(CACHE_STORE).put(data);
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

  public async clearCache(): Promise<void> {
    if (!this.db) await this.init();
    const tx = this.db!.transaction(CACHE_STORE, "readwrite");
    tx.objectStore(CACHE_STORE).clear();
  }

  public async saveUserSubmission(profile: UserProfile): Promise<void> {
    if (!this.db) await this.init();
    const tx = this.db!.transaction(USER_RECORDS_STORE, "readwrite");
    tx.objectStore(USER_RECORDS_STORE).add(profile);
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
    // put(value, key) because SETTINGS_STORE has no keyPath
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
    // Validate that the keyPath property exists to prevent IDB errors
    if (!scheme || !scheme.yojana_name) {
      console.warn("Skipping scheme save: missing yojana_name", scheme);
      return;
    }
    const tx = this.db!.transaction(SCHEME_STORE, "readwrite");
    tx.objectStore(SCHEME_STORE).put(scheme);
  }
}

export const dbService = DBService.getInstance();
