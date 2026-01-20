
export type EligibilityStatus = 'ELIGIBLE' | 'NOT_ELIGIBLE' | 'CONDITIONAL';

export interface Scheme {
  yojana_name: string;
  government: 'Rajasthan Govt' | 'Central Govt';
  category: string;
  short_purpose_hindi: string;
  detailed_benefits: string;
  eligibility_criteria: string[];
  eligibility_status?: EligibilityStatus;
  eligibility_reason_hindi: string;
  required_documents: string[];
  
  // Application Process Guidance (MANDATORY)
  form_source: string; // e.g., "e-Mitra Portal", "Jan-Aadhar Website"
  application_type: 'Online' | 'Offline' | 'Both' | 'Automatic';
  signatures_required: string[]; // e.g., ["Sarpanch", "Patwari", "Applicant"]
  submission_point: string; // e.g., "Gram Panchayat", "Tehsil Office"
  official_pdf_link: string;
  
  scheme_status: 'NEW' | 'ACTIVE' | 'EXPIRED';
  rules_json?: any;

  // New field for suggestions
  other_eligibility_suggestions_hindi?: string;
}

export interface UserProfile {
  // Basic Details
  fullName: string;
  phone: string;
  gender: string;
  dob: string;
  age: number;
  marital_status: string;
  state: string;
  district: string;
  rural_or_urban: string;
  
  // Family & Income
  family_count: string;
  head_of_family: string;
  income: string;
  bpl: string;
  ration_card_type: string;
  
  // Category
  category: string;
  is_tsp_area: string;
  minority: string;

  // Education
  is_studying: string;
  education: string;
  institution_type: string;
  current_class: string;

  // Women & Health
  pregnant: string;
  lactating: string;
  disability: string;
  disability_percent: string;

  // Employment & Farmer
  employment_status: string;
  labour_card: string;
  mnega_card: string;
  is_farmer: string;
  land_owner: string;
  pm_kisan_beneficiary: string;

  // Social
  pension_status: string;
  is_senior_citizen: string;
  is_destitute: string;

  // Govt Service
  is_govt_employee: string;
  family_govt_employee: string;

  // IDs
  jan_aadhar_status: string;
  bank_account_dbt: string;
}

export interface AnalysisResponse {
  hindiContent: string;
  eligible_schemes: Scheme[];
  groundingSources?: any[];
  cached?: boolean;
  timestamp?: number;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: string | null;
}

export interface CachedAnalysis {
  profileHash: string;
  response: AnalysisResponse;
  timestamp: number;
}
