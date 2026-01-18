
export interface Scheme {
  yojana_name: string;
  government: 'Rajasthan Govt' | 'Central Govt';
  applicable_area: string;
  beneficiary_type: string[];
  caste_category: string[];
  short_purpose_hindi: string;
  detailed_benefits: string;
  eligibility: string[];
  required_documents: string[];
  application_process_steps: string[];
  online_apply_link: string;
  offline_process: string;
  official_pdf_link: string;
  scheme_status: 'NEW' | 'UPDATED' | 'ACTIVE' | 'EXPIRED';
  hash_signature?: string;
  last_checked_date?: number;
}

export interface UserProfile {
  gender: string;
  age: string;
  marital_status: string;
  state: string;
  district: string;
  rural_or_urban: string;
  is_tsp_area: string;
  category: string;
  beneficiary_type: string; // Student, Youth, Widow, etc.
  minority: string;
  disability: string;
  disability_percent: string;
  income: string;
  bpl: string;
  education: string;
  occupation: string;
  labour_card: string;
  pregnant: string;
  lactating: string;
  family_count: string;
  head_of_family: string;
}

export interface AnalysisResponse {
  hindiContent: string;
  eligible_schemes: Scheme[];
  groundingSources?: any[];
}

export interface AuthState {
  isAuthenticated: boolean;
  user: string | null;
}

export interface AIAgentLog {
  id: string;
  timestamp: number;
  agent: string;
  action: string;
  description: string;
  status: 'pending' | 'applied' | 'rolled_back';
  diff?: string;
}
