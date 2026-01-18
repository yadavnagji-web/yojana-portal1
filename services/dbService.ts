
import { Scheme, AIAgentLog } from "../types";

const DB_NAME = "SarkariYojanaProDB";
const DB_VERSION = 5; 
const SCHEME_STORE = "schemes_v2";
const SETTINGS_STORE = "settings";
const LOG_STORE = "ai_logs";

export class DBService {
  private static instance: DBService;
  private db: IDBDatabase | null = null;

  private constructor() {}

  public static getInstance(): DBService {
    if (!DBService.instance) {
      DBService.instance = new DBService();
    }
    return DBService.instance;
  }

  public async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.db) return resolve();
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(SCHEME_STORE)) {
          db.createObjectStore(SCHEME_STORE, { keyPath: "yojana_name" });
        }
        if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
          db.createObjectStore(SETTINGS_STORE);
        }
        if (!db.objectStoreNames.contains(LOG_STORE)) {
          db.createObjectStore(LOG_STORE, { keyPath: "id" });
        }
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve();
      };

      request.onerror = (event) => reject((event.target as IDBOpenDBRequest).error);
    });
  }

  // AI Agent Logs
  public async addLog(log: AIAgentLog): Promise<void> {
    if (!this.db) await this.init();
    const tx = this.db!.transaction(LOG_STORE, "readwrite");
    tx.objectStore(LOG_STORE).put(log);
  }

  public async getLogs(): Promise<AIAgentLog[]> {
    if (!this.db) await this.init();
    return new Promise((resolve) => {
      const tx = this.db!.transaction(LOG_STORE, "readonly");
      const req = tx.objectStore(LOG_STORE).getAll();
      req.onsuccess = () => resolve(req.result);
    });
  }

  // Scheme Logic with Hash Detection
  public async upsertScheme(scheme: Scheme): Promise<'INSERT' | 'UPDATE' | 'IGNORE'> {
    if (!this.db) await this.init();
    const existing = await this.getScheme(scheme.yojana_name);
    
    // Simple hash: stringify everything except metadata
    const coreData = { ...scheme, hash_signature: undefined, last_checked_date: undefined, scheme_status: undefined };
    const newHash = btoa(unescape(encodeURIComponent(JSON.stringify(coreData))));
    
    if (!existing) {
      await this.saveScheme({ ...scheme, hash_signature: newHash, last_checked_date: Date.now(), scheme_status: 'NEW' });
      return 'INSERT';
    }

    if (existing.hash_signature !== newHash) {
      await this.saveScheme({ ...scheme, hash_signature: newHash, last_checked_date: Date.now(), scheme_status: 'UPDATED' });
      return 'UPDATE';
    }

    return 'IGNORE';
  }

  private async getScheme(name: string): Promise<Scheme | null> {
    const tx = this.db!.transaction(SCHEME_STORE, "readonly");
    return new Promise((resolve) => {
      const req = tx.objectStore(SCHEME_STORE).get(name);
      req.onsuccess = () => resolve(req.result || null);
    });
  }

  private async saveScheme(scheme: Scheme): Promise<void> {
    const tx = this.db!.transaction(SCHEME_STORE, "readwrite");
    tx.objectStore(SCHEME_STORE).put(scheme);
  }

  public async setSetting(key: string, value: any): Promise<void> {
    if (!this.db) await this.init();
    const tx = this.db!.transaction(SETTINGS_STORE, "readwrite");
    tx.objectStore(SETTINGS_STORE).put(value, key);
  }

  public async getSetting<T>(key: string): Promise<T | null> {
    if (!this.db) await this.init();
    return new Promise((resolve) => {
      const tx = this.db!.transaction(SETTINGS_STORE, "readonly");
      const req = tx.objectStore(SETTINGS_STORE).get(key);
      req.onsuccess = () => resolve(req.result || null);
    });
  }

  public async getAllSchemes(): Promise<Scheme[]> {
    if (!this.db) await this.init();
    return new Promise((resolve) => {
      const tx = this.db!.transaction(SCHEME_STORE, "readonly");
      const req = tx.objectStore(SCHEME_STORE).getAll();
      req.onsuccess = () => resolve(req.result);
    });
  }

  public async deleteScheme(name: string): Promise<void> {
    if (!this.db) await this.init();
    const tx = this.db!.transaction(SCHEME_STORE, "readwrite");
    tx.objectStore(SCHEME_STORE).delete(name);
  }
}

export const dbService = DBService.getInstance();
