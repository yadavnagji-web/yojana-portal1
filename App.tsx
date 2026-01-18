
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
            <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider ${scheme.government?.includes('Rajasthan') ? 'bg-orange-600 text-white' : 'bg-blue-600 text-white'}`}>{scheme.government}</span>
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
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">पात्रता का कारण (Reason)</h4>
            <p className="text-xs text-slate-700 font-bold leading-relaxed bg-orange-50 p-4 rounded-2xl border border-orange-100/50">{scheme.eligibility_reason_hindi}</p>
          </section>

          <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">लाभ (Benefits)</h4>
              <p className="text-xs font-bold text-slate-800 leading-relaxed">{scheme.detailed_benefits}</p>
            </div>
            <div>
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">आवश्यक दस्तावेज</h4>
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
            <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2">📂 आवेदन प्रक्रिया गाइड</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="space-y-3">
                <p><span className="text-slate-400 font-black uppercase text-[9px]">फॉर्म स्रोत:</span><br/><b>{scheme.form_source || 'e-Mitra / Portal'}</b></p>
                <p><span className="text-slate-400 font-black uppercase text-[9px]">प्रकार:</span><br/><b>{scheme.application_type || 'Online'}</b></p>
              </div>
              <div className="space-y-3">
                <p><span className="text-slate-400 font-black uppercase text-[9px]">आवश्यक हस्ताक्षर:</span><br/><b>{scheme.signatures_required?.join(', ') || 'N/A'}</b></p>
                <p><span className="text-slate-400 font-black uppercase text-[9px]">जमा केंद्र:</span><br/><b>{scheme.submission_point || 'e-Mitra'}</b></p>
              </div>
            </div>
            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <a href={scheme.official_pdf_link || "#"} target="_blank" rel="noreferrer" className="flex-1 bg-white border-2 border-slate-200 text-slate-800 py-3 rounded-2xl text-center text-xs font-black shadow-sm">Download Official Form</a>
              <button className="flex-1 bg-orange-600 text-white py-3 rounded-2xl text-center text-xs font-black shadow-lg">Apply Online</button>
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
    setResult(null); // Clear previous results
    try {
      const res = await analyzeEligibility(profile, dummyMode);
      setResult(res);
    } catch (err: any) { 
      console.error("UI Error during analysis:", err);
      alert(err.message || "An unexpected error occurred."); 
    } finally {
      setLoading(false);
    }
  };

  const handleAdminAutoFill = () => {
    setProfile({
      ...INITIAL_PROFILE,
      fullName: 'Sunita Sharma', age: 32, gender: 'Female', marital_status: 'Married',
      income: INCOME_SLABS[0], bpl: 'Yes', ration_card_type: 'BPL', category: 'OBC',
      is_farmer: 'Yes', pm_kisan_beneficiary: 'Yes', jan_aadhar_status: 'Yes'
    });
    setDummyMode(true);
    dbService.setSetting('dummy_mode', true);
    setActiveTab('form');
  };

  return (
    <div className="min-h-screen bg-[#FDFDFD] pb-24">
      <header className="bg-white border-b sticky top-0 z-50 py-4 px-4 shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-orange-600 rounded-2xl flex items-center justify-center text-xl shadow-lg ring-4 ring-orange-50">🇮🇳</div>
             <div>
               <h1 className="text-base font-black text-slate-800">Sarkari Master Engine</h1>
               <p className="text-[9px] font-black text-orange-600 uppercase tracking-widest">2024-25 & 2026 Policy AI</p>
             </div>
          </div>
          <nav className="flex bg-slate-100 p-1 rounded-2xl gap-1">
            <button onClick={() => setActiveTab('form')} className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase ${activeTab === 'form' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-400'}`}>Form</button>
            <button onClick={() => setActiveTab('admin')} className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase ${activeTab === 'admin' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-400'}`}>Admin</button>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {activeTab === 'form' && (
          <div className="space-y-8 animate-slide-up">
            {!result && !loading && (
              <form onSubmit={handleAnalyze} className="bg-white p-8 md:p-12 rounded-[3rem] shadow-2xl border border-slate-50 space-y-12">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <h2 className="text-2xl font-black text-slate-800">Master Profiling Form</h2>
                  {dummyMode && <span className="px-3 py-1 bg-red-600 text-white rounded-full text-[10px] font-black uppercase animate-pulse">Dummy Mode Active</span>}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                  <FormSection title="व्यक्तिगत जानकारी" icon="👤">
                    <input type="text" placeholder="पूरा नाम" value={profile.fullName} onChange={e => setProfile({...profile, fullName: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100" required />
                    <div className="grid grid-cols-2 gap-2">
                       <input type="date" value={profile.dob} onChange={e => setProfile({...profile, dob: e.target.value})} className="p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100" />
                       <select value={profile.gender} onChange={e => setProfile({...profile, gender: e.target.value})} className="p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{GENDER.map(g => <option key={g}>{g}</option>)}</select>
                    </div>
                  </FormSection>

                  <FormSection title="स्थान और श्रेणी" icon="📍">
                    <select value={profile.district} onChange={e => setProfile({...profile, district: e.target.value})} className="p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{RAJASTHAN_DISTRICTS.map(d => <option key={d}>{d}</option>)}</select>
                    <select value={profile.category} onChange={e => setProfile({...profile, category: e.target.value})} className="p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select>
                  </FormSection>

                  <FormSection title="आर्थिक स्थिति" icon="💰">
                    <select value={profile.income} onChange={e => setProfile({...profile, income: e.target.value})} className="p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{INCOME_SLABS.map(s => <option key={s}>{s}</option>)}</select>
                    <div className="grid grid-cols-2 gap-2">
                      <select value={profile.ration_card_type} onChange={e => setProfile({...profile, ration_card_type: e.target.value})} className="p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{RATION_CARD_TYPES.map(r => <option key={r}>{r}</option>)}</select>
                      <select value={profile.bpl} onChange={e => setProfile({...profile, bpl: e.target.value})} className="p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100"><option value="">BPL?</option>{YES_NO.map(y => <option key={y}>{y}</option>)}</select>
                    </div>
                  </FormSection>

                  <FormSection title="शिक्षा और स्वास्थ्य" icon="🎓">
                    <select value={profile.education} onChange={e => setProfile({...profile, education: e.target.value})} className="p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{EDUCATION_LEVELS.map(e => <option key={e}>{e}</option>)}</select>
                    <select value={profile.pregnant} onChange={e => setProfile({...profile, pregnant: e.target.value})} className="p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100"><option value="">Pregnant?</option>{YES_NO.map(y => <option key={y}>{y}</option>)}</select>
                  </FormSection>

                  <FormSection title="पेंशन और व्यवसाय" icon="🏦">
                    <select value={profile.pension_status} onChange={e => setProfile({...profile, pension_status: e.target.value})} className="p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{PENSION_STATUS.map(p => <option key={p}>{p}</option>)}</select>
                    <select value={profile.employment_status} onChange={e => setProfile({...profile, employment_status: e.target.value})} className="p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{EMPLOYMENT_STATUS.map(s => <option key={s}>{s}</option>)}</select>
                  </FormSection>

                  <FormSection title="किसान / भूमि" icon="🚜">
                    <div className="grid grid-cols-2 gap-2">
                      <select value={profile.is_farmer} onChange={e => setProfile({...profile, is_farmer: e.target.value})} className="p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100"><option value="">Farmer?</option>{YES_NO.map(y => <option key={y}>{y}</option>)}</select>
                      <select value={profile.land_owner} onChange={e => setProfile({...profile, land_owner: e.target.value})} className="p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100"><option value="">Land Owner?</option>{YES_NO.map(y => <option key={y}>{y}</option>)}</select>
                    </div>
                  </FormSection>
                </div>

                <button type="submit" className="w-full py-6 bg-orange-600 text-white font-black rounded-3xl shadow-xl uppercase tracking-widest hover:bg-orange-700 transition-all active:scale-95">Check Eligibility 🚀</button>
              </form>
            )}

            {loading && (
              <div className="py-24 text-center space-y-6">
                <div className="w-16 h-16 border-4 border-orange-100 border-t-orange-600 rounded-full animate-spin mx-auto shadow-inner"></div>
                <p className="font-black text-slate-400 uppercase text-xs tracking-[0.3em]">AI searching policies (2024-2026)...</p>
              </div>
            )}

            {result && !loading && (
              <div className="space-y-8 animate-slide-up">
                <div className="bg-white p-8 md:p-12 rounded-[3rem] shadow-2xl border border-slate-50">
                   <div className="flex justify-between items-center mb-10">
                     <h2 className="text-2xl font-black text-slate-800">पात्र योजनाएं</h2>
                     <button onClick={() => setResult(null)} className="px-6 py-2 bg-slate-100 text-slate-500 font-bold rounded-xl text-xs">Reset Form</button>
                   </div>
                   
                   <div className="bg-orange-50/50 p-6 rounded-3xl mb-10 text-sm font-bold text-slate-700 italic border border-orange-100 whitespace-pre-wrap">
                      {result.hindiContent}
                   </div>

                   <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {result.eligible_schemes.length > 0 ? (
                        result.eligible_schemes.map((s, idx) => <SchemeCard key={idx} scheme={s} />)
                      ) : (
                        <p className="col-span-2 text-center py-10 font-bold text-slate-400">कोई योजना नहीं मिली। कृपया विवरण जांचें।</p>
                      )}
                   </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'admin' && (
          <div className="max-w-xl mx-auto space-y-8">
            {!auth.isAuthenticated ? (
               <div className="bg-white p-12 rounded-[3rem] shadow-2xl text-center space-y-8">
                  <h2 className="text-2xl font-black text-slate-800">Admin Login</h2>
                  <form onSubmit={e => {
                    e.preventDefault();
                    if(loginForm.email === 'yadavnagji@gmail.com' && loginForm.password === '123456') setAuth({ isAuthenticated: true, user: 'Nagji' });
                    else alert("Access Denied");
                  }} className="space-y-4">
                    <input type="email" required onChange={e => setLoginForm({...loginForm, email: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100" placeholder="Admin Email" />
                    <input type="password" required onChange={e => setLoginForm({...loginForm, password: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100" placeholder="Password" />
                    <button type="submit" className="w-full py-5 bg-orange-600 text-white font-black rounded-2xl shadow-xl">Secure Login</button>
                  </form>
               </div>
            ) : (
              <div className="bg-white p-10 rounded-[3rem] shadow-2xl space-y-12">
                <div className="flex justify-between items-center pb-8 border-b">
                   <h2 className="text-xl font-black">Dashboard</h2>
                   <button onClick={() => setAuth({isAuthenticated: false, user: null})} className="text-xs font-bold text-red-500">Logout</button>
                </div>
                
                <section className="space-y-6">
                  <button onClick={handleAdminAutoFill} className="w-full py-6 bg-orange-600 text-white font-black rounded-3xl shadow-lg hover:scale-[1.02] transition-all">🚀 Auto-Fill Dummy Test Data</button>
                  <div className="flex items-center justify-between p-6 bg-slate-50 rounded-3xl border">
                    <span className="font-bold text-sm">Dummy Mode (No Database Save)</span>
                    <input type="checkbox" checked={dummyMode} onChange={async (e) => {
                      const val = e.target.checked;
                      setDummyMode(val);
                      await dbService.setSetting('dummy_mode', val);
                    }} className="w-6 h-6 accent-orange-600" />
                  </div>
                </section>

                <section className="space-y-6 pt-8 border-t">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">API Configuration</h3>
                  <div className="space-y-4">
                     <input type="password" value={apiKeys.gemini} onChange={e => setApiKeys({...apiKeys, gemini: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-mono text-[10px] ring-1 ring-slate-100" placeholder="Gemini API Key" />
                     <input type="password" value={apiKeys.groq} onChange={e => setApiKeys({...apiKeys, groq: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-mono text-[10px] ring-1 ring-slate-100" placeholder="Groq API Key (gsk_...)" />
                     <button onClick={() => dbService.setSetting('api_keys', apiKeys).then(() => alert("Saved!"))} className="w-full py-4 bg-slate-900 text-white font-black rounded-2xl shadow-lg">Save Persistent Keys</button>
                  </div>
                </section>
              </div>
            )}
          </div>
        )}
      </main>
      <footer className="py-12 text-center opacity-20 text-[9px] font-black uppercase tracking-[0.5em] fixed bottom-0 left-0 right-0 bg-white/50 backdrop-blur-sm z-40 border-t border-slate-50">Sarkari Master Engine • Dual Engine AI • Verified 2024-2026</footer>
    </div>
  );
};

export default App;
