
import React, { useState, useEffect } from 'react';
import { UserProfile, AnalysisResponse, Scheme, AuthState, EligibilityStatus } from './types';
import { 
  RAJASTHAN_DISTRICTS, CATEGORIES, GENDER, INCOME_SLABS, MARITAL_STATUS,
  YES_NO, RATION_CARD_TYPES, EMPLOYMENT_STATUS, GOVT_SERVICE, 
  RURAL_URBAN, EDUCATION_LEVELS, INSTITUTION_TYPES, PENSION_STATUS
} from './constants';
import FormSection from './components/FormSection';
import { analyzeEligibility, testApiConnection } from './services/geminiService';
import { dbService } from './services/dbService';

const StatusBadge: React.FC<{ status?: EligibilityStatus }> = ({ status }) => {
  const safeStatus = status || 'CONDITIONAL';
  const config = {
    ELIGIBLE: { bg: 'bg-green-100', text: 'text-green-700', label: '✅ पात्र' },
    NOT_ELIGIBLE: { bg: 'bg-red-100', text: 'text-red-700', label: '❌ अपात्र' },
    CONDITIONAL: { bg: 'bg-amber-100', text: 'text-amber-700', label: '⚠️ दस्तावेज जमा करें' }
  };
  const { bg, text, label } = config[safeStatus] || config['CONDITIONAL'];
  return <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase ${bg} ${text}`}>{label}</span>;
};

const GroundingSources: React.FC<{ sources?: any[] }> = ({ sources }) => {
  if (!sources || sources.length === 0) return null;
  
  return (
    <div className="mt-6 p-4 bg-slate-50 rounded-2xl border border-slate-100">
      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">खोज के आधार (Sources)</h4>
      <div className="flex flex-wrap gap-2">
        {sources.map((chunk, idx) => {
          const uri = chunk.web?.uri || chunk.maps?.uri;
          const title = chunk.web?.title || chunk.maps?.title || "Reference Source";
          if (!uri) return null;
          return (
            <a key={idx} href={uri} target="_blank" rel="noreferrer" className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-600 hover:border-orange-500 hover:text-orange-600 transition-all flex items-center gap-2">
              <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
              {title.length > 40 ? title.substring(0, 37) + "..." : title}
            </a>
          );
        })}
      </div>
    </div>
  );
};

const SchemesTable: React.FC<{ schemes: Scheme[] }> = ({ schemes }) => {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  return (
    <div className="overflow-x-auto bg-white rounded-3xl border border-slate-100 shadow-xl">
      <table className="w-full text-left border-collapse min-w-[900px]">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-100">
            <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">योजना</th>
            <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">मुख्य लाभ</th>
            <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">पात्रता</th>
            <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">कार्रवाई</th>
          </tr>
        </thead>
        <tbody>
          {schemes.map((scheme, idx) => {
            const isExpanded = expandedId === idx;
            return (
              <React.Fragment key={`${scheme?.yojana_name || 'y'}-${idx}`}>
                <tr 
                  className={`border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer ${isExpanded ? 'bg-orange-50/40' : ''}`} 
                  onClick={() => setExpandedId(isExpanded ? null : idx)}
                >
                  <td className="p-5">
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-black text-slate-800">{scheme?.yojana_name || 'योजना नाम अनुपलब्ध'}</span>
                      <span className={`text-[9px] font-bold uppercase w-fit px-1.5 py-0.5 rounded ${scheme?.government?.includes('Rajasthan') ? 'bg-orange-600 text-white' : 'bg-blue-600 text-white'}`}>
                        {scheme?.government || 'सरकारी'}
                      </span>
                    </div>
                  </td>
                  <td className="p-5">
                    <p className="text-xs text-slate-600 font-bold line-clamp-2 max-w-xs">{scheme?.detailed_benefits || 'विवरण प्रक्रियाधीन...'}</p>
                  </td>
                  <td className="p-5">
                    <StatusBadge status={scheme?.eligibility_status} />
                  </td>
                  <td className="p-5 text-center">
                    <button className="px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase hover:bg-orange-600 transition-all shadow-sm">
                      {isExpanded ? 'बंद' : 'खोलें'}
                    </button>
                  </td>
                </tr>
                {isExpanded && (
                  <tr className="bg-orange-50/20">
                    <td colSpan={4} className="p-8">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-10 animate-slide-up">
                        <div className="space-y-4">
                          <h4 className="text-[10px] font-black text-orange-600 uppercase tracking-widest">आवेदन रोडमैप</h4>
                          <div className="space-y-3 bg-white p-5 rounded-2xl border border-orange-100 shadow-sm">
                            <div>
                              <p className="text-[9px] font-black text-slate-400 uppercase">हस्ताक्षर</p>
                              <p className="text-xs font-bold text-slate-800">
                                {Array.isArray(scheme?.signatures_required) ? scheme.signatures_required.join(", ") : (scheme?.signatures_required || "स्वयं")}
                              </p>
                            </div>
                            <div>
                              <p className="text-[9px] font-black text-slate-400 uppercase">जमा स्थान</p>
                              <p className="text-xs font-bold text-slate-800">{scheme?.submission_point || 'ई-मित्र / कार्यालय'}</p>
                            </div>
                            <div>
                              <p className="text-[9px] font-black text-slate-400 uppercase">प्रक्रिया</p>
                              <p className="text-xs font-bold text-slate-800">{scheme?.application_type || 'ऑनलाइन'}</p>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">दस्तावेज़</h4>
                          <ul className="space-y-2">
                            {Array.isArray(scheme?.required_documents) ? scheme.required_documents.map((doc, i) => (
                              <li key={i} className="text-[11px] font-bold text-slate-600 flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-100">
                                <span className="w-2 h-2 bg-green-500 rounded-full shrink-0"></span> {doc}
                              </li>
                            )) : <li className="text-[11px] font-bold text-slate-600">जानकारी उपलब्ध नहीं</li>}
                          </ul>
                        </div>

                        <div className="space-y-4">
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">पात्रता का आधार</h4>
                          <div className="bg-white p-5 rounded-2xl border border-slate-100 italic text-xs text-slate-600 font-bold leading-relaxed mb-4">
                            "{scheme?.eligibility_reason_hindi || 'आपकी प्रोफाइल इस योजना के मानदंडों को पूरा करती है।'}"
                          </div>
                          <a 
                            href={scheme?.official_pdf_link && scheme.official_pdf_link !== "#" ? scheme.official_pdf_link : "https://www.google.com/search?q=" + encodeURIComponent(scheme?.yojana_name || '')} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="block w-full py-4 bg-slate-900 text-white text-center rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-black shadow-lg"
                          >
                            आधिकारिक पोर्टल
                          </a>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'form' | 'admin'>('form');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [auth, setAuth] = useState<AuthState>({ isAuthenticated: false, user: null });
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [apiKeys, setApiKeys] = useState({ gemini: '', groq: '' });
  const [apiStatus, setApiStatus] = useState({ gemini: 'idle', groq: 'idle' });
  
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
    });
  }, []);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const res = await analyzeEligibility(profile, false);
      setResult(res);
    } catch (err: any) { 
      alert(err.message || "API Error."); 
    } finally {
      setLoading(false);
    }
  };

  const checkApi = async (provider: 'gemini' | 'groq') => {
    setApiStatus(prev => ({ ...prev, [provider]: 'loading' }));
    const ok = await testApiConnection(provider, apiKeys[provider]);
    setApiStatus(prev => ({ ...prev, [provider]: ok ? 'success' : 'error' }));
  };

  return (
    <div className="min-h-screen bg-[#FDFDFD] flex flex-col font-sans">
      <header className="bg-white border-b sticky top-0 z-50 py-4 px-4 shadow-sm shrink-0">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-orange-600 rounded-2xl flex items-center justify-center text-xl shadow-lg ring-4 ring-orange-50">🇮🇳</div>
             <div>
               <h1 className="text-base font-black text-slate-800 leading-none">Sarkari Master Engine</h1>
               <p className="text-[9px] font-black text-orange-600 uppercase tracking-widest mt-1">Live AI Analyzer</p>
             </div>
          </div>
          <nav className="flex bg-slate-100 p-1 rounded-2xl gap-1">
            <button onClick={() => setActiveTab('form')} className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase transition-all ${activeTab === 'form' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-400'}`}>खोज फॉर्म</button>
            <button onClick={() => setActiveTab('admin')} className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase transition-all ${activeTab === 'admin' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-400'}`}>एडमिन</button>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 flex-1 w-full">
        {activeTab === 'form' && (
          <div className="space-y-8 animate-slide-up">
            {!result && !loading && (
              <form onSubmit={handleAnalyze} className="bg-white p-6 md:p-12 rounded-[3.5rem] shadow-2xl border border-slate-50 space-y-12">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-y-12 gap-x-10">
                  <FormSection title="व्यक्तिगत" icon="👤">
                    <input type="text" value={profile.fullName} onChange={e => setProfile({...profile, fullName: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100" placeholder="पूरा नाम" required />
                    <div className="grid grid-cols-2 gap-3">
                      <select value={profile.gender} onChange={e => setProfile({...profile, gender: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{GENDER.map(g => <option key={g}>{g}</option>)}</select>
                      <select value={profile.marital_status} onChange={e => setProfile({...profile, marital_status: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{MARITAL_STATUS.map(m => <option key={m}>{m}</option>)}</select>
                    </div>
                  </FormSection>
                  
                  <FormSection title="स्थान" icon="📍">
                    <select value={profile.district} onChange={e => setProfile({...profile, district: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{RAJASTHAN_DISTRICTS.map(d => <option key={d}>{d}</option>)}</select>
                    <select value={profile.category} onChange={e => setProfile({...profile, category: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select>
                  </FormSection>

                  <FormSection title="आर्थिक" icon="💰">
                    <select value={profile.income} onChange={e => setProfile({...profile, income: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{INCOME_SLABS.map(s => <option key={s}>{s}</option>)}</select>
                    <select value={profile.bpl} onChange={e => setProfile({...profile, bpl: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{YES_NO.map(y => <option key={y}>{y}</option>)}</select>
                  </FormSection>

                  <FormSection title="विशेष" icon="🏥">
                    <div className="grid grid-cols-2 gap-3">
                      <select value={profile.is_farmer} onChange={e => setProfile({...profile, is_farmer: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{YES_NO.map(y => <option key={y}>{y}</option>)}</select>
                      <select value={profile.disability} onChange={e => setProfile({...profile, disability: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{YES_NO.map(y => <option key={y}>{y}</option>)}</select>
                    </div>
                  </FormSection>
                </div>

                <div className="pt-6 text-center">
                  <button type="submit" className="w-full max-w-2xl py-6 bg-orange-600 text-white font-black rounded-3xl shadow-2xl hover:bg-orange-700 active:scale-95 transition-all uppercase tracking-widest">
                    योजनाएं खोजें 🚀
                  </button>
                </div>
              </form>
            )}

            {loading && (
              <div className="py-24 text-center space-y-8 flex flex-col items-center">
                <div className="w-20 h-20 border-8 border-orange-100 border-t-orange-600 rounded-full animate-spin"></div>
                <p className="font-black text-slate-800 text-xl">सरकारी पोर्टल्स से 15+ योजनाएं खोज रहे हैं...</p>
              </div>
            )}

            {result && !loading && (
              <div className="space-y-8 mb-12 animate-slide-up">
                <div className="bg-white p-6 md:p-12 rounded-[3.5rem] shadow-2xl border border-slate-50">
                   <div className="flex justify-between items-center mb-8">
                     <h2 className="text-2xl font-black text-slate-800">खोज परिणाम ({result.eligible_schemes.length})</h2>
                     <button onClick={() => setResult(null)} className="px-5 py-2 bg-slate-100 text-slate-500 font-black rounded-xl text-[10px] uppercase">नया फॉर्म</button>
                   </div>

                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                      <div className="bg-blue-50 p-6 rounded-3xl border border-blue-100 flex flex-col gap-2">
                        <p className="text-[10px] font-black text-blue-400 uppercase">सहायता लिंक</p>
                        <p className="text-xs font-bold text-blue-800">राजस्थान योजना खोज पोर्टल:</p>
                        <a href="https://www.myscheme.gov.in/hi/search/state/Rajasthan" target="_blank" rel="noreferrer" className="text-blue-600 underline font-black text-sm">myscheme.gov.in/Rajasthan</a>
                      </div>
                      <div className="bg-orange-50 p-6 rounded-3xl border border-orange-100">
                        <p className="text-[10px] font-black text-orange-400 uppercase">AI विश्लेषण</p>
                        <p className="text-xs font-bold text-slate-700 mt-2 leading-relaxed">{result.hindiContent}</p>
                      </div>
                   </div>

                   <SchemesTable schemes={result.eligible_schemes} />
                   <GroundingSources sources={result.groundingSources} />
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'admin' && (
          <div className="max-w-xl mx-auto">
            {!auth.isAuthenticated ? (
               <div className="bg-white p-12 rounded-[3.5rem] shadow-2xl border border-slate-50 text-center space-y-8">
                  <h2 className="text-2xl font-black text-slate-800">एडमिन लॉगिन</h2>
                  <form onSubmit={e => {
                    e.preventDefault();
                    if(loginForm.email === 'yadavnagji@gmail.com' && loginForm.password === '123456') setAuth({ isAuthenticated: true, user: 'Nagji' });
                    else alert("गलत जानकारी");
                  }} className="space-y-4">
                    <input type="email" required onChange={e => setLoginForm({...loginForm, email: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs" placeholder="ईमेल" />
                    <input type="password" required onChange={e => setLoginForm({...loginForm, password: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs" placeholder="पासवर्ड" />
                    <button type="submit" className="w-full py-4 bg-orange-600 text-white font-black rounded-2xl">लॉगिन</button>
                  </form>
               </div>
            ) : (
              <div className="bg-white p-10 rounded-[3.5rem] shadow-2xl space-y-10">
                <section className="space-y-6">
                  <h3 className="text-xs font-black uppercase text-slate-400">API कीज़</h3>
                  <div className="space-y-4">
                     <input type="password" value={apiKeys.gemini} onChange={e => setApiKeys({...apiKeys, gemini: e.target.value})} className="w-full p-4 bg-slate-50 rounded-xl text-xs" placeholder="Gemini Key" />
                     <input type="password" value={apiKeys.groq} onChange={e => setApiKeys({...apiKeys, groq: e.target.value})} className="w-full p-4 bg-slate-50 rounded-xl text-xs" placeholder="Groq Key (Backup)" />
                     <button onClick={() => dbService.setSetting('api_keys', apiKeys).then(() => alert("Saved!"))} className="w-full py-4 bg-orange-600 text-white font-black rounded-2xl shadow-lg">Keys सेव करें</button>
                  </div>
                </section>
                <button onClick={() => setAuth({ isAuthenticated: false, user: null })} className="text-[10px] font-black text-slate-400 uppercase underline">लॉग आउट</button>
              </div>
            )}
          </div>
        )}
      </main>
      <footer className="py-8 text-center text-slate-400 shrink-0">
        <p className="text-[9px] font-black uppercase tracking-[0.4em]">Sarkari Master Engine • Dual AI • Nagji Yadav</p>
      </footer>
    </div>
  );
};

export default App;
