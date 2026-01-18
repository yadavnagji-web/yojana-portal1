
import React, { useState, useEffect } from 'react';
import { UserProfile, AnalysisResponse, Scheme, AuthState, EligibilityStatus } from './types';
import { 
  RAJASTHAN_DISTRICTS, CATEGORIES, GENDER, INCOME_SLABS, MARITAL_STATUS,
  YES_NO, RATION_CARD_TYPES, EMPLOYMENT_STATUS, GOVT_SERVICE, 
  RURAL_URBAN, EDUCATION_LEVELS, INSTITUTION_TYPES, PENSION_STATUS
} from './constants';
import FormSection from './components/FormSection';
import { analyzeEligibility, fetchMasterSchemes } from './services/geminiService';
import { dbService } from './services/dbService';

const StatusBadge: React.FC<{ status: EligibilityStatus }> = ({ status }) => {
  const config = {
    ELIGIBLE: { bg: 'bg-green-100', text: 'text-green-700', label: '✅ पात्र (Eligible)' },
    NOT_ELIGIBLE: { bg: 'bg-red-100', text: 'text-red-700', label: '❌ अपात्र (Not Eligible)' },
    CONDITIONAL: { bg: 'bg-amber-100', text: 'text-amber-700', label: '⚠️ दस्तावेज़ आवश्यक (Conditional)' }
  };
  const { bg, text, label } = config[status || 'NOT_ELIGIBLE'];
  return <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${bg} ${text}`}>{label}</span>;
};

const SchemeCard: React.FC<{ scheme: Scheme }> = ({ scheme }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={`bg-white rounded-[2.5rem] border transition-all duration-300 overflow-hidden ${isOpen ? 'border-orange-500 shadow-2xl' : 'border-slate-100 shadow-sm hover:shadow-md'}`}>
      <div className="p-6 flex items-start justify-between cursor-pointer" onClick={() => setIsOpen(!isOpen)}>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider ${scheme.government.includes('Rajasthan') ? 'bg-orange-600 text-white' : 'bg-blue-600 text-white'}`}>{scheme.government}</span>
            <StatusBadge status={scheme.eligibility_status!} />
          </div>
          <h3 className="text-lg font-black text-slate-800 leading-tight">{scheme.yojana_name}</h3>
          <p className="text-xs text-slate-500 mt-2 font-medium line-clamp-1">{scheme.short_purpose_hindi}</p>
        </div>
        <div className={`w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center transition-transform ${isOpen ? 'rotate-180' : ''}`}>
          <span className="text-slate-400 text-[10px]">▼</span>
        </div>
      </div>
      
      {isOpen && (
        <div className="px-6 pb-8 pt-2 space-y-6 border-t border-slate-50">
          <section>
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">पात्रता का कारण (Eligibility Reason)</h4>
            <p className="text-xs text-slate-700 font-bold leading-relaxed bg-orange-50 p-4 rounded-2xl border border-orange-100/50">{scheme.eligibility_reason_hindi}</p>
          </section>

          <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">लाभ (Benefits)</h4>
              <p className="text-xs font-bold text-slate-800 leading-relaxed">{scheme.detailed_benefits}</p>
            </div>
            <div>
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">आवश्यक दस्तावेज (Documents)</h4>
              <ul className="space-y-1.5">
                {(scheme.required_documents || []).map((doc, i) => (
                  <li key={i} className="text-[11px] font-bold text-slate-600 flex items-start gap-2">
                    <span className="w-1.5 h-1.5 bg-orange-400 rounded-full mt-1 shrink-0"></span> {doc}
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="bg-slate-50 rounded-[2rem] p-6 border border-slate-100">
            <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2">
              📂 आवेदन प्रक्रिया एवं फॉर्म गाइड (Process Guide)
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="space-y-3">
                <p><span className="text-slate-400 font-black uppercase text-[9px]">फॉर्म का स्रोत:</span><br/><b>{scheme.form_source || 'e-Mitra Portal / Official Website'}</b></p>
                <p><span className="text-slate-400 font-black uppercase text-[9px]">आवेदन का प्रकार:</span><br/><b>{scheme.application_type || 'Online/Offline'}</b></p>
              </div>
              <div className="space-y-3">
                <p><span className="text-slate-400 font-black uppercase text-[9px]">फॉर्म पर आवश्यक हस्ताक्षर:</span><br/><b>{scheme.signatures_required?.join(', ') || 'Applicant'}</b></p>
                <p><span className="text-slate-400 font-black uppercase text-[9px]">जमा कहाँ करना है:</span><br/><b>{scheme.submission_point || 'Nearest e-Mitra / Gram Panchayat'}</b></p>
              </div>
            </div>
            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <a href={scheme.official_pdf_link || "#"} target="_blank" rel="noreferrer" className="flex-1 bg-white border-2 border-slate-200 text-slate-800 py-3.5 rounded-2xl text-center text-xs font-black hover:border-orange-500 transition-colors shadow-sm">Official PDF Form Download</a>
              <button className="flex-1 bg-orange-600 text-white py-3.5 rounded-2xl text-center text-xs font-black shadow-lg hover:bg-orange-700 transition-all active:scale-95">Apply on e-Mitra</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'form' | 'admin'>('form');
  const [dummyMode, setDummyMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [auth, setAuth] = useState<AuthState>({ isAuthenticated: false, user: null });
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [apiKeys, setApiKeys] = useState({ gemini: '', groq: '' });
  
  const INITIAL_PROFILE: UserProfile = {
    fullName: '', phone: '', gender: 'Female', dob: '1995-01-01', age: 30, marital_status: 'Married', 
    state: 'Rajasthan', district: 'Jaipur', rural_or_urban: 'Rural', family_count: '4', head_of_family: 'Yes',
    income: INCOME_SLABS[1], bpl: 'No', ration_card_type: 'APL', category: 'General', is_tsp_area: 'No',
    minority: 'No', is_studying: 'No', education: 'Graduate', institution_type: 'N/A', current_class: 'N/A',
    pregnant: 'No', lactating: 'No', disability: 'No', disability_percent: '0', employment_status: 'Unemployed',
    labour_card: 'No', mnega_card: 'No', is_farmer: 'No', land_owner: 'No', pm_kisan_beneficiary: 'No',
    pension_status: 'None', is_senior_citizen: 'No', is_destitute: 'No', is_govt_employee: 'None',
    family_govt_employee: 'None', jan_aadhar_status: 'Yes', bank_account_dbt: 'Yes'
  };

  const [profile, setProfile] = useState<UserProfile>(INITIAL_PROFILE);

  useEffect(() => {
    dbService.init().then(async () => {
      const keys = await dbService.getSetting<any>('api_keys');
      if (keys) setApiKeys(keys);
      const dMode = await dbService.getSetting<boolean>('dummy_mode');
      if (dMode !== null) setDummyMode(dMode);
    });
  }, []);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await analyzeEligibility(profile, dummyMode);
      setResult(res);
    } catch (err: any) { 
      alert(err.message); 
      setLoading(false);
    }
    setLoading(false);
  };

  const handleAdminAutoFill = () => {
    setProfile({
      ...INITIAL_PROFILE,
      fullName: 'Sita Devi', phone: '9001234567', age: 34, dob: '1990-05-10', gender: 'Female',
      is_farmer: 'Yes', district: 'Banswara', is_tsp_area: 'Yes', category: 'ST', ration_card_type: 'BPL',
      bpl: 'Yes', family_count: '5', head_of_family: 'Yes', income: INCOME_SLABS[0],
      pregnant: 'No', lactating: 'Yes', education: 'Middle', employment_status: 'Unemployed',
      land_owner: 'Yes', pm_kisan_beneficiary: 'Yes', jan_aadhar_status: 'Yes', bank_account_dbt: 'Yes'
    });
    setDummyMode(true);
    dbService.setSetting('dummy_mode', true);
    setActiveTab('form');
  };

  return (
    <div className="min-h-screen bg-[#FDFDFD] font-sans pb-24">
      <header className="bg-white/95 backdrop-blur-md border-b border-slate-100 sticky top-0 z-50 py-4 px-4 shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-orange-600 rounded-2xl flex items-center justify-center text-xl shadow-lg ring-4 ring-orange-50">🇮🇳</div>
             <div>
               <h1 className="text-base font-black text-slate-800 leading-none">Sarkari Master Engine</h1>
               <p className="text-[9px] font-black text-orange-600 uppercase tracking-widest mt-1">Rajasthan & Central Welfare Platform</p>
             </div>
          </div>
          <nav className="flex bg-slate-100 p-1 rounded-2xl gap-1">
            <button onClick={() => setActiveTab('form')} className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase transition-all ${activeTab === 'form' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-400'}`}>Eligibility Form</button>
            <button onClick={() => setActiveTab('admin')} className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase transition-all ${activeTab === 'admin' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-400'}`}>Admin Panel</button>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {activeTab === 'form' && (
          <div className="space-y-8 animate-slide-up">
            {!result && !loading && (
              <form onSubmit={handleAnalyze} className="bg-white p-8 md:p-12 rounded-[3.5rem] shadow-2xl shadow-orange-100/30 border border-slate-50 space-y-12">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-black text-slate-800">Master Profiling Form</h2>
                    <p className="text-xs font-bold text-slate-400 mt-1">सभी योजनाओं की एक साथ जाँच के लिए सम्पूर्ण विवरण भरें</p>
                  </div>
                  {dummyMode && (
                    <span className="px-4 py-1.5 bg-red-600 text-white rounded-full text-[10px] font-black uppercase animate-pulse shadow-lg">Dummy Mode Active</span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-y-16 gap-x-12">
                  <FormSection title="व्यक्तिगत और वैवाहिक (Personal)" icon="👤">
                    <input type="text" placeholder="पूरा नाम (Full Name)" value={profile.fullName} onChange={e => setProfile({...profile, fullName: e.target.value})} className="w-full p-4 bg-slate-50 border-0 rounded-2xl font-bold text-xs ring-1 ring-slate-100" />
                    <div className="grid grid-cols-2 gap-2">
                       <input type="date" value={profile.dob} onChange={e => setProfile({...profile, dob: e.target.value})} className="p-4 bg-slate-50 border-0 rounded-2xl font-bold text-xs ring-1 ring-slate-100" />
                       <select value={profile.gender} onChange={e => setProfile({...profile, gender: e.target.value})} className="p-4 bg-slate-50 border-0 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{GENDER.map(g => <option key={g}>{g}</option>)}</select>
                    </div>
                    <select value={profile.marital_status} onChange={e => setProfile({...profile, marital_status: e.target.value})} className="w-full p-4 bg-slate-50 border-0 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{MARITAL_STATUS.map(m => <option key={m}>{m}</option>)}</select>
                  </FormSection>

                  <FormSection title="क्षेत्र और सामाजिक श्रेणी (Location)" icon="📍">
                    <div className="grid grid-cols-2 gap-2">
                      <select value={profile.district} onChange={e => setProfile({...profile, district: e.target.value})} className="p-4 bg-slate-50 border-0 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{RAJASTHAN_DISTRICTS.map(d => <option key={d}>{d}</option>)}</select>
                      <select value={profile.rural_or_urban} onChange={e => setProfile({...profile, rural_or_urban: e.target.value})} className="p-4 bg-slate-50 border-0 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{RURAL_URBAN.map(r => <option key={r}>{r}</option>)}</select>
                    </div>
                    <select value={profile.category} onChange={e => setProfile({...profile, category: e.target.value})} className="w-full p-4 bg-slate-50 border-0 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select>
                    <div className="grid grid-cols-2 gap-2">
                      <select value={profile.is_tsp_area} onChange={e => setProfile({...profile, is_tsp_area: e.target.value})} className="p-4 bg-slate-50 border-0 rounded-2xl font-bold text-xs ring-1 ring-slate-100"><option value="">TSP?</option>{YES_NO.map(y => <option key={y}>{y}</option>)}</select>
                      <select value={profile.minority} onChange={e => setProfile({...profile, minority: e.target.value})} className="p-4 bg-slate-50 border-0 rounded-2xl font-bold text-xs ring-1 ring-slate-100"><option value="">Minority?</option>{YES_NO.map(y => <option key={y}>{y}</option>)}</select>
                    </div>
                  </FormSection>

                  <FormSection title="आर्थिक विवरण (Economy)" icon="💰">
                    <select value={profile.income} onChange={e => setProfile({...profile, income: e.target.value})} className="w-full p-4 bg-slate-50 border-0 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{INCOME_SLABS.map(s => <option key={s}>{s}</option>)}</select>
                    <div className="grid grid-cols-2 gap-2">
                      <select value={profile.ration_card_type} onChange={e => setProfile({...profile, ration_card_type: e.target.value})} className="p-4 bg-slate-50 border-0 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{RATION_CARD_TYPES.map(r => <option key={r}>{r}</option>)}</select>
                      <select value={profile.bpl} onChange={e => setProfile({...profile, bpl: e.target.value})} className="p-4 bg-slate-50 border-0 rounded-2xl font-bold text-xs ring-1 ring-slate-100"><option value="">BPL?</option>{YES_NO.map(y => <option key={y}>{y}</option>)}</select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input type="number" placeholder="Family Count" value={profile.family_count} onChange={e => setProfile({...profile, family_count: e.target.value})} className="p-4 bg-slate-50 border-0 rounded-2xl font-bold text-xs ring-1 ring-slate-100" />
                      <select value={profile.head_of_family} onChange={e => setProfile({...profile, head_of_family: e.target.value})} className="p-4 bg-slate-50 border-0 rounded-2xl font-bold text-xs ring-1 ring-slate-100"><option value="">Is Head?</option>{YES_NO.map(y => <option key={y}>{y}</option>)}</select>
                    </div>
                  </FormSection>

                  <FormSection title="शिक्षा विवरण (Education)" icon="🎓">
                    <select value={profile.is_studying} onChange={e => setProfile({...profile, is_studying: e.target.value})} className="w-full p-4 bg-slate-50 border-0 rounded-2xl font-bold text-xs ring-1 ring-slate-100"><option value="">Currently Studying?</option>{YES_NO.map(y => <option key={y}>{y}</option>)}</select>
                    <select value={profile.education} onChange={e => setProfile({...profile, education: e.target.value})} className="w-full p-4 bg-slate-50 border-0 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{EDUCATION_LEVELS.map(e => <option key={e}>{e}</option>)}</select>
                    <select value={profile.institution_type} onChange={e => setProfile({...profile, institution_type: e.target.value})} className="w-full p-4 bg-slate-50 border-0 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{INSTITUTION_TYPES.map(t => <option key={t}>{t}</option>)}</select>
                  </FormSection>

                  <FormSection title="स्वास्थ्य और पेंशन (Health)" icon="♿">
                    <div className="grid grid-cols-2 gap-2">
                      <select value={profile.pregnant} onChange={e => setProfile({...profile, pregnant: e.target.value})} className="p-4 bg-slate-50 border-0 rounded-2xl font-bold text-xs ring-1 ring-slate-100"><option value="">Pregnant?</option>{YES_NO.map(y => <option key={y}>{y}</option>)}</select>
                      <select value={profile.lactating} onChange={e => setProfile({...profile, lactating: e.target.value})} className="p-4 bg-slate-50 border-0 rounded-2xl font-bold text-xs ring-1 ring-slate-100"><option value="">Lactating?</option>{YES_NO.map(y => <option key={y}>{y}</option>)}</select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <select value={profile.disability} onChange={e => setProfile({...profile, disability: e.target.value})} className="p-4 bg-slate-50 border-0 rounded-2xl font-bold text-xs ring-1 ring-slate-100"><option value="">Disability?</option>{YES_NO.map(y => <option key={y}>{y}</option>)}</select>
                      <input type="number" placeholder="Disability %" value={profile.disability_percent} onChange={e => setProfile({...profile, disability_percent: e.target.value})} className="p-4 bg-slate-50 border-0 rounded-2xl font-bold text-xs ring-1 ring-slate-100" />
                    </div>
                    <select value={profile.pension_status} onChange={e => setProfile({...profile, pension_status: e.target.value})} className="w-full p-4 bg-slate-50 border-0 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{PENSION_STATUS.map(p => <option key={p}>{p}</option>)}</select>
                  </FormSection>

                  <FormSection title="रोजगार और किसान (Work)" icon="🚜">
                    <select value={profile.employment_status} onChange={e => setProfile({...profile, employment_status: e.target.value})} className="w-full p-4 bg-slate-50 border-0 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{EMPLOYMENT_STATUS.map(s => <option key={s}>{s}</option>)}</select>
                    <div className="grid grid-cols-2 gap-2">
                      <select value={profile.is_farmer} onChange={e => setProfile({...profile, is_farmer: e.target.value})} className="p-4 bg-slate-50 border-0 rounded-2xl font-bold text-xs ring-1 ring-slate-100"><option value="">Farmer?</option>{YES_NO.map(y => <option key={y}>{y}</option>)}</select>
                      <select value={profile.land_owner} onChange={e => setProfile({...profile, land_owner: e.target.value})} className="p-4 bg-slate-50 border-0 rounded-2xl font-bold text-xs ring-1 ring-slate-100"><option value="">Land Owner?</option>{YES_NO.map(y => <option key={y}>{y}</option>)}</select>
                    </div>
                    <select value={profile.is_govt_employee} onChange={e => setProfile({...profile, is_govt_employee: e.target.value})} className="w-full p-4 bg-slate-50 border-0 rounded-2xl font-bold text-xs ring-1 ring-slate-100"><option value="">Self Govt Service?</option>{GOVT_SERVICE.map(s => <option key={s}>{s}</option>)}</select>
                  </FormSection>
                </div>

                <div className="pt-6 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-6">
                   <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100 w-full md:w-auto">
                      <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center text-orange-600">📝</div>
                      <div>
                        <span className="text-[10px] font-black text-slate-400 uppercase">Documents Check</span>
                        <div className="flex gap-4">
                           <label className="flex items-center gap-2 cursor-pointer">
                             <input type="checkbox" checked={profile.jan_aadhar_status === 'Yes'} onChange={e => setProfile({...profile, jan_aadhar_status: e.target.checked ? 'Yes' : 'No'})} className="w-4 h-4 accent-orange-600" />
                             <span className="text-xs font-bold text-slate-700">जन-आधार</span>
                           </label>
                           <label className="flex items-center gap-2 cursor-pointer">
                             <input type="checkbox" checked={profile.bank_account_dbt === 'Yes'} onChange={e => setProfile({...profile, bank_account_dbt: e.target.checked ? 'Yes' : 'No'})} className="w-4 h-4 accent-orange-600" />
                             <span className="text-xs font-bold text-slate-700">Bank DBT</span>
                           </label>
                        </div>
                      </div>
                   </div>
                   <button type="submit" className="w-full md:flex-1 py-6 bg-orange-600 text-white font-black rounded-[2.5rem] shadow-xl uppercase tracking-widest hover:bg-orange-700 transition-all active:scale-[0.98]">योग्यता की जांच करें (Check All Schemes) 🚀</button>
                </div>
              </form>
            )}

            {loading && (
              <div className="py-20 text-center space-y-6">
                <div className="w-16 h-16 border-4 border-orange-100 border-t-orange-600 rounded-full animate-spin mx-auto shadow-inner"></div>
                <p className="font-black text-slate-400 uppercase text-xs tracking-[0.3em] animate-pulse">Processing Rules Engine (2024-2026)...</p>
              </div>
            )}

            {result && !loading && (
              <div className="space-y-8 animate-slide-up">
                <div className="bg-white p-8 md:p-12 rounded-[3.5rem] shadow-2xl border border-slate-50">
                   <div className="flex flex-col sm:flex-row items-center justify-between mb-10 gap-4">
                     <div>
                       <h2 className="text-2xl font-black text-slate-800">आपके लिए चुनी गई योजनाएं</h2>
                       <p className="text-xs font-bold text-slate-400 mt-1">Found {result.eligible_schemes.length} Eligible Results (Active & Upcoming 2026)</p>
                     </div>
                     <button onClick={() => setResult(null)} className="px-8 py-3.5 bg-slate-100 text-slate-500 font-black rounded-2xl text-xs hover:bg-orange-50 hover:text-orange-600 transition-all">नया फॉर्म भरें (Reset)</button>
                   </div>
                   
                   <div className="bg-orange-50/50 p-6 md:p-8 rounded-[2.5rem] mb-10 text-sm text-slate-700 leading-relaxed font-bold border border-orange-100/50 italic whitespace-pre-wrap shadow-inner">
                      {result.hindiContent}
                   </div>

                   {result.groundingSources && result.groundingSources.length > 0 && (
                     <div className="mb-10 p-5 bg-blue-50/50 rounded-[2rem] border border-blue-100">
                        <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                          <span className="w-2 h-2 bg-blue-500 rounded-full"></span> Verified Policy Sources:
                        </h4>
                        <div className="flex flex-wrap gap-2">
                           {result.groundingSources.map((source: any, i: number) => (
                             <a key={i} href={source.web?.uri} target="_blank" rel="noreferrer" className="px-4 py-2 bg-white border border-blue-200 rounded-xl text-[10px] font-bold text-blue-700 hover:bg-blue-100 hover:border-blue-400 transition-all shadow-sm">
                               {source.web?.title || 'Official Govt Link'}
                             </a>
                           ))}
                        </div>
                     </div>
                   )}

                   <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {result.eligible_schemes.map((s, idx) => <SchemeCard key={idx} scheme={s} />)}
                   </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'admin' && (
          <div className="max-w-2xl mx-auto space-y-8 animate-slide-up">
            {!auth.isAuthenticated ? (
               <div className="bg-white p-12 rounded-[3.5rem] shadow-2xl border border-slate-50 text-center space-y-8">
                  <div className="w-16 h-16 bg-slate-100 rounded-2xl mx-auto flex items-center justify-center text-2xl">🔒</div>
                  <h2 className="text-2xl font-black text-slate-800">Admin Authentication</h2>
                  <form onSubmit={e => {
                    e.preventDefault();
                    if(loginForm.email === 'yadavnagji@gmail.com' && loginForm.password === '123456') setAuth({ isAuthenticated: true, user: 'Nagji' });
                    else alert("Access Denied: Incorrect Credentials");
                  }} className="space-y-4 text-left">
                    <input type="email" required onChange={e => setLoginForm({...loginForm, email: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl border-0 font-bold text-xs ring-1 ring-slate-100 focus:ring-orange-500" placeholder="Admin Email" />
                    <input type="password" required onChange={e => setLoginForm({...loginForm, password: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl border-0 font-bold text-xs ring-1 ring-slate-100 focus:ring-orange-500" placeholder="Password" />
                    <button type="submit" className="w-full py-5 bg-orange-600 text-white font-black rounded-2xl shadow-xl hover:bg-orange-700 transition-all">Secure Login</button>
                  </form>
               </div>
            ) : (
              <div className="bg-white p-10 rounded-[3.5rem] shadow-2xl border border-slate-50 space-y-12">
                <div className="flex items-center justify-between border-b border-slate-50 pb-8">
                   <div>
                     <h2 className="text-xl font-black text-slate-800">System Dashboard</h2>
                     <p className="text-[10px] font-bold text-slate-400">Welcome, Admin {auth.user}</p>
                   </div>
                   <button onClick={() => setAuth({isAuthenticated: false, user: null})} className="text-[10px] font-black text-slate-400 uppercase hover:text-red-500 transition-colors">Logout Session</button>
                </div>
                
                <section className="space-y-6">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Testing & Development</h3>
                  <div className="grid grid-cols-1 gap-4">
                    <button onClick={handleAdminAutoFill} className="w-full py-6 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-black rounded-[2rem] text-xs uppercase tracking-widest shadow-xl shadow-orange-200/50 hover:scale-[1.02] transition-all">
                      🚀 Auto-Fill Realistic Dummy Data
                    </button>
                    <div className="flex items-center justify-between p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                      <div>
                        <span className="text-xs font-black text-slate-800 block">Dummy Mode (No DB Logging)</span>
                        <p className="text-[10px] text-slate-400 font-bold mt-1">Stops all analysis records from saving to IndexedDB</p>
                      </div>
                      <input 
                        type="checkbox" 
                        checked={dummyMode} 
                        onChange={async (e) => {
                          const val = e.target.checked;
                          setDummyMode(val);
                          await dbService.setSetting('dummy_mode', val);
                        }} 
                        className="w-8 h-8 accent-orange-600 cursor-pointer" 
                      />
                    </div>
                  </div>
                </section>

                <section className="space-y-6 pt-8 border-t border-slate-50">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Configuration & Storage</h3>
                  <div className="space-y-5">
                     <button onClick={() => dbService.clearCache().then(() => alert("All Analysis Cache Purged!"))} className="w-full py-4 bg-red-50 text-red-600 font-black rounded-2xl text-[10px] uppercase tracking-widest border border-red-100 hover:bg-red-100 transition-colors">Clear Local Cache</button>
                     <div className="space-y-3">
                        <div className="flex flex-col gap-1">
                           <span className="text-[9px] font-bold text-slate-400 uppercase ml-3">Gemini API Key</span>
                           <input type="password" value={apiKeys.gemini} onChange={e => setApiKeys({...apiKeys, gemini: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl border-0 font-mono text-[11px] ring-1 ring-slate-200 focus:ring-orange-500" placeholder="Paste Gemini Key here" />
                        </div>
                        <div className="flex flex-col gap-1">
                           <span className="text-[9px] font-bold text-slate-400 uppercase ml-3">Groq API Key (Fast Inference)</span>
                           <input type="password" value={apiKeys.groq} onChange={e => setApiKeys({...apiKeys, groq: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl border-0 font-mono text-[11px] ring-1 ring-slate-200 focus:ring-orange-500" placeholder="Paste Groq Cloud Key (gsk_...)" />
                        </div>
                        <button onClick={() => dbService.setSetting('api_keys', apiKeys).then(() => alert("Keys Securely Saved in DB!"))} className="w-full py-4 bg-slate-900 text-white font-black rounded-2xl text-[10px] uppercase tracking-widest shadow-xl hover:bg-black transition-all">Save Encrypted Persistent Keys</button>
                     </div>
                  </div>
                </section>

                <section className="space-y-4 pt-8 border-t border-slate-50">
                  <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 text-center">
                    <p className="text-[10px] font-bold text-blue-600">Database Schemes Sync (2024-2026)</p>
                    <div className="flex gap-2 mt-3">
                       <button onClick={() => fetchMasterSchemes('Rajasthan')} className="flex-1 py-3 bg-white text-blue-600 font-black rounded-xl text-[9px] uppercase border border-blue-200 hover:bg-blue-600 hover:text-white transition-all">Sync Rajasthan Master</button>
                       <button onClick={() => fetchMasterSchemes('Central')} className="flex-1 py-3 bg-white text-blue-600 font-black rounded-xl text-[9px] uppercase border border-blue-200 hover:bg-blue-600 hover:text-white transition-all">Sync Central Master</button>
                    </div>
                  </div>
                </section>
              </div>
            )}
          </div>
        )}
      </main>
      <footer className="py-12 text-center opacity-30 text-[9px] font-black uppercase tracking-[0.5em] fixed bottom-0 left-0 right-0 bg-white/50 backdrop-blur-sm z-40 border-t border-slate-50">Sarkari Master Engine • Dual Engine 3.0 • Verified 2026 Ready</footer>
    </div>
  );
};

export default App;
