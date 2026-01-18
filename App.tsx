
import React, { useState, useEffect } from 'react';
import { UserProfile, AnalysisResponse, Scheme, AuthState, EligibilityStatus } from './types';
import { 
  RAJASTHAN_DISTRICTS, CATEGORIES, GENDER, INCOME_SLABS, MARITAL_STATUS,
  YES_NO, RATION_CARD_TYPES, EMPLOYMENT_STATUS, GOVT_SERVICE, 
  RURAL_URBAN, EDUCATION_LEVELS, INSTITUTION_TYPES, PENSION_STATUS
} from './constants';
import FormSection from './components/FormSection';
import { analyzeEligibility } from './services/geminiService';
import { dbService } from './services/dbService';

const StatusBadge: React.FC<{ status: EligibilityStatus }> = ({ status }) => {
  const config = {
    ELIGIBLE: { bg: 'bg-green-100', text: 'text-green-700', label: '✅ पात्र' },
    NOT_ELIGIBLE: { bg: 'bg-red-100', text: 'text-red-700', label: '❌ अपात्र' },
    CONDITIONAL: { bg: 'bg-amber-100', text: 'text-amber-700', label: '⚠️ दस्तावेज़ आधारित' }
  };
  const { bg, text, label } = config[status || 'NOT_ELIGIBLE'];
  return <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase ${bg} ${text}`}>{label}</span>;
};

const SchemesTable: React.FC<{ schemes: Scheme[] }> = ({ schemes }) => {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  return (
    <div className="overflow-x-auto bg-white rounded-3xl border border-slate-100 shadow-xl">
      <table className="w-full text-left border-collapse min-w-[800px]">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-100">
            <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">योजना का नाम और सरकार</th>
            <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">मुख्य लाभ</th>
            <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">पात्रता स्थिति</th>
            <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">कार्य (Action)</th>
          </tr>
        </thead>
        <tbody>
          {schemes.map((scheme, idx) => (
            <React.Fragment key={idx}>
              <tr className={`border-b border-slate-50 hover:bg-slate-50/50 transition-colors cursor-pointer ${expandedId === idx ? 'bg-orange-50/30' : ''}`} onClick={() => setExpandedId(expandedId === idx ? null : idx)}>
                <td className="p-5">
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-black text-slate-800">{scheme.yojana_name}</span>
                    <span className={`text-[9px] font-bold uppercase w-fit px-1.5 py-0.5 rounded ${scheme.government?.includes('Rajasthan') ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                      {scheme.government}
                    </span>
                  </div>
                </td>
                <td className="p-5">
                  <p className="text-xs text-slate-600 font-bold line-clamp-2 max-w-xs">{scheme.detailed_benefits}</p>
                </td>
                <td className="p-5">
                  <StatusBadge status={scheme.eligibility_status!} />
                </td>
                <td className="p-5 text-center">
                  <button className="px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-orange-600 transition-all shadow-sm">
                    {expandedId === idx ? 'बंद करें' : 'विवरण देखें'}
                  </button>
                </td>
              </tr>
              {expandedId === idx && (
                <tr className="bg-orange-50/20">
                  <td colSpan={4} className="p-8">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-10 animate-slide-up">
                      <div className="space-y-4">
                        <h4 className="text-[10px] font-black text-orange-600 uppercase tracking-widest">आवेदन कैसे करें (Roadmap)</h4>
                        <div className="space-y-3 bg-white p-5 rounded-2xl border border-orange-100 shadow-sm">
                          <div className="flex gap-3">
                            <span className="w-5 h-5 rounded bg-orange-100 text-orange-600 flex items-center justify-center text-[10px] font-black">1</span>
                            <div>
                              <p className="text-[9px] font-black text-slate-400 uppercase">हस्ताक्षर</p>
                              <p className="text-xs font-bold text-slate-800">{(scheme.signatures_required || []).join(", ")}</p>
                            </div>
                          </div>
                          <div className="flex gap-3">
                            <span className="w-5 h-5 rounded bg-orange-100 text-orange-600 flex items-center justify-center text-[10px] font-black">2</span>
                            <div>
                              <p className="text-[9px] font-black text-slate-400 uppercase">जमा केंद्र</p>
                              <p className="text-xs font-bold text-slate-800">{scheme.submission_point || 'ई-मित्र केंद्र'}</p>
                            </div>
                          </div>
                          <div className="flex gap-3">
                            <span className="w-5 h-5 rounded bg-orange-100 text-orange-600 flex items-center justify-center text-[10px] font-black">3</span>
                            <div>
                              <p className="text-[9px] font-black text-slate-400 uppercase">प्रकार</p>
                              <p className="text-xs font-bold text-slate-800">{scheme.application_type || 'ऑनलाइन'}</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">जरूरी दस्तावेज़</h4>
                        <ul className="space-y-2">
                          {(scheme.required_documents || []).map((doc, i) => (
                            <li key={i} className="text-[11px] font-bold text-slate-600 flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-100">
                              <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span> {doc}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="space-y-4">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">पात्रता का कारण</h4>
                        <div className="bg-white p-5 rounded-2xl border border-slate-100 italic text-xs text-slate-500 font-bold leading-relaxed">
                          "{scheme.eligibility_reason_hindi}"
                        </div>
                        <div className="pt-4 flex flex-col gap-3">
                          <a href={scheme.official_pdf_link || "#"} target="_blank" rel="noreferrer" className="w-full py-3 bg-slate-900 text-white text-center rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black">आधिकारिक पोर्टल</a>
                          <p className="text-[9px] text-center text-slate-400 font-bold">स्रोत: {scheme.form_source || 'Govt Official Portal'}</p>
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
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
    setResult(null);
    try {
      const res = await analyzeEligibility(profile, dummyMode);
      setResult(res);
    } catch (err: any) { 
      console.error(err);
      alert(err.message || "खोज विफल रही। कृपया इंटरनेट और Admin में API Key जांचें।"); 
    } finally {
      setLoading(false);
    }
  };

  const handleAdminAutoFill = () => {
    setProfile({
      ...INITIAL_PROFILE,
      fullName: 'Anita Devi', age: 34, gender: 'Female', marital_status: 'Married',
      district: 'Banswara', is_tsp_area: 'Yes', category: 'ST',
      income: INCOME_SLABS[0], bpl: 'Yes', ration_card_type: 'BPL',
      is_farmer: 'Yes', jan_aadhar_status: 'Yes'
    });
    setDummyMode(true);
    dbService.setSetting('dummy_mode', true);
    setActiveTab('form');
  };

  return (
    <div className="min-h-screen bg-[#FDFDFD] flex flex-col font-sans">
      <header className="bg-white border-b sticky top-0 z-50 py-4 px-4 shadow-sm shrink-0">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-orange-600 rounded-2xl flex items-center justify-center text-xl shadow-lg ring-4 ring-orange-50">🇮🇳</div>
             <div>
               <h1 className="text-base font-black text-slate-800 leading-none">Sarkari Master Engine</h1>
               <p className="text-[9px] font-black text-orange-600 uppercase tracking-widest mt-1">Live Search AI Verified (2024-25)</p>
             </div>
          </div>
          <nav className="flex bg-slate-100 p-1 rounded-2xl gap-1">
            <button onClick={() => setActiveTab('form')} className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase transition-all ${activeTab === 'form' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-400'}`}>आवेदन फॉर्म</button>
            <button onClick={() => setActiveTab('admin')} className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase transition-all ${activeTab === 'admin' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-400'}`}>एडमिन</button>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 flex-1 w-full">
        {activeTab === 'form' && (
          <div className="space-y-8 animate-slide-up">
            {!result && !loading && (
              <form onSubmit={handleAnalyze} className="bg-white p-6 md:p-12 rounded-[3.5rem] shadow-2xl border border-slate-50 space-y-12">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-black text-slate-800">पात्रता प्रोफाइल फॉर्म</h2>
                    <p className="text-xs font-bold text-slate-400 mt-1">सरकारी वेबसाइटों से लाइव जानकारी प्राप्त करने के लिए विवरण भरें</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-y-10 gap-x-12">
                  <FormSection title="व्यक्तिगत विवरण" icon="👤">
                    <div className="space-y-2">
                      <label className="block text-[11px] font-black text-slate-500 uppercase ml-2">पूरा नाम</label>
                      <input type="text" value={profile.fullName} onChange={e => setProfile({...profile, fullName: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100 focus:ring-orange-500 outline-none" placeholder="उदा. राहुल कुमार" required />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="block text-[11px] font-black text-slate-500 uppercase ml-2">जन्म तिथि</label>
                        <input type="date" value={profile.dob} onChange={e => setProfile({...profile, dob: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100" />
                      </div>
                      <div className="space-y-2">
                        <label className="block text-[11px] font-black text-slate-500 uppercase ml-2">लिंग</label>
                        <select value={profile.gender} onChange={e => setProfile({...profile, gender: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{GENDER.map(g => <option key={g}>{g}</option>)}</select>
                      </div>
                    </div>
                  </FormSection>

                  <FormSection title="स्थान और श्रेणी" icon="📍">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="block text-[11px] font-black text-slate-500 uppercase ml-2">जिला (Rajasthan)</label>
                        <select value={profile.district} onChange={e => setProfile({...profile, district: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{RAJASTHAN_DISTRICTS.map(d => <option key={d}>{d}</option>)}</select>
                      </div>
                      <div className="space-y-2">
                        <label className="block text-[11px] font-black text-slate-500 uppercase ml-2">क्षेत्र</label>
                        <select value={profile.rural_or_urban} onChange={e => setProfile({...profile, rural_or_urban: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{RURAL_URBAN.map(r => <option key={r}>{r}</option>)}</select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-[11px] font-black text-slate-500 uppercase ml-2">जाति वर्ग</label>
                      <select value={profile.category} onChange={e => setProfile({...profile, category: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select>
                    </div>
                  </FormSection>

                  <FormSection title="आर्थिक जानकारी" icon="💰">
                    <div className="space-y-2">
                      <label className="block text-[11px] font-black text-slate-500 uppercase ml-2">सालाना आय</label>
                      <select value={profile.income} onChange={e => setProfile({...profile, income: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{INCOME_SLABS.map(s => <option key={s}>{s}</option>)}</select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="block text-[11px] font-black text-slate-500 uppercase ml-2">राशन कार्ड</label>
                        <select value={profile.ration_card_type} onChange={e => setProfile({...profile, ration_card_type: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{RATION_CARD_TYPES.map(r => <option key={r}>{r}</option>)}</select>
                      </div>
                      <div className="space-y-2">
                        <label className="block text-[11px] font-black text-slate-500 uppercase ml-2">BPL कार्ड?</label>
                        <select value={profile.bpl} onChange={e => setProfile({...profile, bpl: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{YES_NO.map(y => <option key={y}>{y}</option>)}</select>
                      </div>
                    </div>
                  </FormSection>

                  <FormSection title="शिक्षा और स्वास्थ्य" icon="🎓">
                    <div className="space-y-2">
                      <label className="block text-[11px] font-black text-slate-500 uppercase ml-2">शिक्षा</label>
                      <select value={profile.education} onChange={e => setProfile({...profile, education: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{EDUCATION_LEVELS.map(e => <option key={e}>{e}</option>)}</select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="block text-[11px] font-black text-slate-500 uppercase ml-2">गर्भवती?</label>
                        <select value={profile.pregnant} onChange={e => setProfile({...profile, pregnant: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{YES_NO.map(y => <option key={y}>{y}</option>)}</select>
                      </div>
                      <div className="space-y-2">
                        <label className="block text-[11px] font-black text-slate-500 uppercase ml-2">दिव्यांग?</label>
                        <select value={profile.disability} onChange={e => setProfile({...profile, disability: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{YES_NO.map(y => <option key={y}>{y}</option>)}</select>
                      </div>
                    </div>
                  </FormSection>

                  <FormSection title="व्यवसाय और किसान" icon="🚜">
                    <div className="space-y-2">
                      <label className="block text-[11px] font-black text-slate-500 uppercase ml-2">किसान?</label>
                      <select value={profile.is_farmer} onChange={e => setProfile({...profile, is_farmer: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{YES_NO.map(y => <option key={y}>{y}</option>)}</select>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-[11px] font-black text-slate-500 uppercase ml-2">आईडी</label>
                      <div className="grid grid-cols-2 gap-4">
                        <select value={profile.jan_aadhar_status} onChange={e => setProfile({...profile, jan_aadhar_status: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{YES_NO.map(y => <option key={y}>{y}</option>)}</select>
                        <p className="text-[8px] font-bold text-slate-400 self-center">जन-आधार कार्ड</p>
                      </div>
                    </div>
                  </FormSection>
                </div>

                <div className="pt-6">
                  <button type="submit" className="w-full py-6 bg-orange-600 text-white font-black rounded-3xl shadow-xl hover:bg-orange-700 active:scale-95 transition-all text-sm md:text-base">सरकारी पोर्टल से लाइव खोजें 🚀</button>
                </div>
              </form>
            )}

            {loading && (
              <div className="py-24 text-center space-y-8 flex flex-col items-center justify-center">
                <div className="relative">
                  <div className="w-24 h-24 border-[10px] border-orange-100 border-t-orange-600 rounded-full animate-spin shadow-inner"></div>
                  <div className="absolute inset-0 flex items-center justify-center text-xs font-black text-orange-600">AI</div>
                </div>
                <div className="space-y-2">
                  <p className="font-black text-slate-800 text-xl">सरकारी पोर्टल्स (Rajasthan & India) की लाइव जांच हो रही है...</p>
                  <p className="font-bold text-slate-400 uppercase text-[10px] tracking-[0.3em]">Searching india.gov.in & rajasthan.gov.in</p>
                </div>
              </div>
            )}

            {result && !loading && (
              <div className="space-y-8 animate-slide-up mb-12">
                <div className="bg-white p-6 md:p-12 rounded-[3.5rem] shadow-2xl border border-slate-50">
                   <div className="flex flex-col sm:flex-row justify-between items-center mb-10 gap-4">
                     <div>
                       <h2 className="text-2xl font-black text-slate-800">लाइव खोज परिणाम ({result.eligible_schemes.length})</h2>
                       <p className="text-xs font-bold text-slate-400 mt-1">आपकी पात्रता के अनुसार वास्तविक और सक्रिय योजनाएं</p>
                     </div>
                     <button onClick={() => setResult(null)} className="px-8 py-3 bg-slate-100 text-slate-500 font-black rounded-2xl text-[10px] uppercase hover:bg-orange-50 hover:text-orange-600 transition-all">नई खोज</button>
                   </div>
                   
                   <div className="bg-orange-50/50 p-6 md:p-8 rounded-[2.5rem] mb-10 text-sm font-bold text-slate-700 italic border border-orange-100/50 whitespace-pre-wrap shadow-inner leading-relaxed">
                      {result.hindiContent}
                   </div>

                   {result.eligible_schemes.length > 0 ? (
                     <SchemesTable schemes={result.eligible_schemes} />
                   ) : (
                     <div className="text-center py-24 bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200">
                       <p className="text-xl font-black text-slate-300">कोई डेटा नहीं मिला।</p>
                       <p className="text-xs font-bold text-slate-400 mt-2">कृपया Admin में अपनी API Key जांचें या विवरण बदलें।</p>
                     </div>
                   )}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'admin' && (
          <div className="max-w-xl mx-auto space-y-8 pb-12">
            {!auth.isAuthenticated ? (
               <div className="bg-white p-12 rounded-[3.5rem] shadow-2xl text-center space-y-8 border border-slate-50">
                  <h2 className="text-2xl font-black text-slate-800">Admin Login</h2>
                  <form onSubmit={e => {
                    e.preventDefault();
                    if(loginForm.email === 'yadavnagji@gmail.com' && loginForm.password === '123456') setAuth({ isAuthenticated: true, user: 'Nagji' });
                    else alert("Access Denied");
                  }} className="space-y-4">
                    <input type="email" required onChange={e => setLoginForm({...loginForm, email: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100" placeholder="Admin Email" />
                    <input type="password" required onChange={e => setLoginForm({...loginForm, password: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100" placeholder="Password" />
                    <button type="submit" className="w-full py-5 bg-orange-600 text-white font-black rounded-2xl shadow-xl">Login</button>
                  </form>
               </div>
            ) : (
              <div className="bg-white p-10 rounded-[3.5rem] shadow-2xl space-y-12 border border-slate-50">
                <button onClick={handleAdminAutoFill} className="w-full py-6 bg-orange-600 text-white font-black rounded-3xl shadow-lg">🚀 Auto-Fill Realistic Data</button>
                <section className="space-y-6 pt-8 border-t border-slate-100">
                  <h3 className="text-xs font-black uppercase text-slate-400">API Settings</h3>
                  <div className="space-y-4">
                     <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Gemini Key (Required for Search)</label>
                        <input type="password" value={apiKeys.gemini} onChange={e => setApiKeys({...apiKeys, gemini: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-mono text-[11px] ring-1 ring-slate-200" placeholder="Gemini Key" />
                     </div>
                     <button onClick={() => dbService.setSetting('api_keys', apiKeys).then(() => alert("Settings Saved!"))} className="w-full py-4 bg-slate-900 text-white font-black rounded-2xl shadow-xl hover:bg-black transition-all">Save Keys</button>
                  </div>
                </section>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="py-8 text-center bg-white border-t border-slate-100 shrink-0 mt-auto w-full">
        <p className="opacity-30 text-[9px] font-black uppercase tracking-[0.4em]">Sarkari Master Engine • Live Web Grounding (2024-2025)</p>
      </footer>
    </div>
  );
};

export default App;
