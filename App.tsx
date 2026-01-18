
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

const StatusBadge: React.FC<{ status: EligibilityStatus }> = ({ status }) => {
  const config = {
    ELIGIBLE: { bg: 'bg-green-100', text: 'text-green-700', label: '✅ पात्र' },
    NOT_ELIGIBLE: { bg: 'bg-red-100', text: 'text-red-700', label: '❌ अपात्र' },
    CONDITIONAL: { bg: 'bg-amber-100', text: 'text-amber-700', label: '⚠️ दस्तावेज़' }
  };
  const { bg, text, label } = config[status || 'NOT_ELIGIBLE'];
  return <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase ${bg} ${text}`}>{label}</span>;
};

const SchemesTable: React.FC<{ schemes: Scheme[] }> = ({ schemes }) => {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  return (
    <div className="overflow-x-auto bg-white rounded-3xl border border-slate-100 shadow-xl">
      <table className="w-full text-left border-collapse min-w-[900px]">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-100">
            <th className="p-5 text-[10px] font-black text-slate-400 uppercase">योजना का नाम</th>
            <th className="p-5 text-[10px] font-black text-slate-400 uppercase">मुख्य लाभ</th>
            <th className="p-5 text-[10px] font-black text-slate-400 uppercase">स्थिति</th>
            <th className="p-5 text-[10px] font-black text-slate-400 uppercase text-center">विवरण</th>
          </tr>
        </thead>
        <tbody>
          {schemes.map((scheme, idx) => (
            <React.Fragment key={idx}>
              <tr className={`border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer ${expandedId === idx ? 'bg-orange-50/40' : ''}`} onClick={() => setExpandedId(expandedId === idx ? null : idx)}>
                <td className="p-5">
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-black text-slate-800">{scheme.yojana_name}</span>
                    <span className={`text-[9px] font-bold uppercase w-fit px-1.5 py-0.5 rounded ${scheme.government?.includes('Rajasthan') ? 'bg-orange-600 text-white' : 'bg-blue-600 text-white'}`}>
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
                  <button className="px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase">
                    {expandedId === idx ? 'बंद' : 'देखें'}
                  </button>
                </td>
              </tr>
              {expandedId === idx && (
                <tr className="bg-orange-50/20">
                  <td colSpan={4} className="p-8">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-10 animate-slide-up">
                      <div className="space-y-4">
                        <h4 className="text-[10px] font-black text-orange-600 uppercase">आवेदन रोडमैप</h4>
                        <div className="space-y-3 bg-white p-5 rounded-2xl border border-orange-100 shadow-sm">
                          <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase">हस्ताक्षर चाहिए</p>
                            <p className="text-xs font-bold text-slate-800">{(scheme.signatures_required || []).join(", ") || "आवेदक"}</p>
                          </div>
                          <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase">जमा स्थान</p>
                            <p className="text-xs font-bold text-slate-800">{scheme.submission_point || 'ई-मित्र / पंचायत'}</p>
                          </div>
                          <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase">तरीका</p>
                            <p className="text-xs font-bold text-slate-800">{scheme.application_type || 'ऑनलाइन'}</p>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase">दस्तावेज़</h4>
                        <ul className="space-y-2">
                          {(scheme.required_documents || []).map((doc, i) => (
                            <li key={i} className="text-[11px] font-bold text-slate-600 flex items-center gap-2 bg-white p-2 rounded-xl border border-slate-100">
                              <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span> {doc}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="space-y-4">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase">पात्रता तर्क</h4>
                        <p className="bg-white p-4 rounded-2xl border border-slate-100 italic text-xs text-slate-600 font-bold">"{scheme.eligibility_reason_hindi}"</p>
                        <a href={scheme.official_pdf_link || "#"} target="_blank" rel="noreferrer" className="block w-full py-4 bg-slate-900 text-white text-center rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg">आधिकारिक पोर्टल</a>
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
      alert(err.message || "API Error: Please check settings."); 
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
               <p className="text-[9px] font-black text-orange-600 uppercase tracking-widest mt-1">Dual AI Analytics (Gemini + Groq)</p>
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-y-12 gap-x-10">
                  <FormSection title="व्यक्तिगत" icon="👤">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase">पूरा नाम</label>
                      <input type="text" value={profile.fullName} onChange={e => setProfile({...profile, fullName: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100 focus:ring-orange-500" placeholder="नाम" required />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase">लिंग</label>
                        <select value={profile.gender} onChange={e => setProfile({...profile, gender: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{GENDER.map(g => <option key={g}>{g}</option>)}</select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase">वैवाहिक</label>
                        <select value={profile.marital_status} onChange={e => setProfile({...profile, marital_status: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{MARITAL_STATUS.map(m => <option key={m}>{m}</option>)}</select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase">जन्म तिथि</label>
                      <input type="date" value={profile.dob} onChange={e => setProfile({...profile, dob: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100" />
                    </div>
                  </FormSection>

                  <FormSection title="स्थान" icon="📍">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase">जिला (Rajasthan)</label>
                      <select value={profile.district} onChange={e => setProfile({...profile, district: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{RAJASTHAN_DISTRICTS.map(d => <option key={d}>{d}</option>)}</select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase">क्षेत्र</label>
                      <select value={profile.rural_or_urban} onChange={e => setProfile({...profile, rural_or_urban: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{RURAL_URBAN.map(r => <option key={r}>{r}</option>)}</select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase">TSP?</label>
                        <select value={profile.is_tsp_area} onChange={e => setProfile({...profile, is_tsp_area: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{YES_NO.map(y => <option key={y}>{y}</option>)}</select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase">वर्ग</label>
                        <select value={profile.category} onChange={e => setProfile({...profile, category: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select>
                      </div>
                    </div>
                  </FormSection>

                  <FormSection title="आर्थिक" icon="💰">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase">सालाना आय</label>
                      <select value={profile.income} onChange={e => setProfile({...profile, income: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{INCOME_SLABS.map(s => <option key={s}>{s}</option>)}</select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase">BPL?</label>
                        <select value={profile.bpl} onChange={e => setProfile({...profile, bpl: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{YES_NO.map(y => <option key={y}>{y}</option>)}</select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase">राशन</label>
                        <select value={profile.ration_card_type} onChange={e => setProfile({...profile, ration_card_type: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{RATION_CARD_TYPES.map(r => <option key={r}>{r}</option>)}</select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase">परिवार संख्या</label>
                        <input type="number" value={profile.family_count} onChange={e => setProfile({...profile, family_count: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase">मुखिया?</label>
                        <select value={profile.head_of_family} onChange={e => setProfile({...profile, head_of_family: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{YES_NO.map(y => <option key={y}>{y}</option>)}</select>
                      </div>
                    </div>
                  </FormSection>

                  <FormSection title="शिक्षा" icon="🎓">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase">अभी पढ़ रहे हैं?</label>
                      <select value={profile.is_studying} onChange={e => setProfile({...profile, is_studying: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{YES_NO.map(y => <option key={y}>{y}</option>)}</select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase">शिक्षा स्तर</label>
                      <select value={profile.education} onChange={e => setProfile({...profile, education: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{EDUCATION_LEVELS.map(e => <option key={e}>{e}</option>)}</select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase">संस्थान</label>
                      <select value={profile.institution_type} onChange={e => setProfile({...profile, institution_type: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{INSTITUTION_TYPES.map(i => <option key={i}>{i}</option>)}</select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase">कक्षा</label>
                      <input type="text" value={profile.current_class} onChange={e => setProfile({...profile, current_class: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100" />
                    </div>
                  </FormSection>

                  <FormSection title="स्वास्थ्य/पेंशन" icon="🏥">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase">गर्भवती?</label>
                        <select value={profile.pregnant} onChange={e => setProfile({...profile, pregnant: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{YES_NO.map(y => <option key={y}>{y}</option>)}</select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase">दिव्यांग?</label>
                        <select value={profile.disability} onChange={e => setProfile({...profile, disability: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{YES_NO.map(y => <option key={y}>{y}</option>)}</select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase">पेंशन स्थिति</label>
                      <select value={profile.pension_status} onChange={e => setProfile({...profile, pension_status: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{PENSION_STATUS.map(p => <option key={p}>{p}</option>)}</select>
                    </div>
                  </FormSection>

                  <FormSection title="कार्य/किसान" icon="🚜">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase">किसान?</label>
                        <select value={profile.is_farmer} onChange={e => setProfile({...profile, is_farmer: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{YES_NO.map(y => <option key={y}>{y}</option>)}</select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase">MNREGA?</label>
                        <select value={profile.mnega_card} onChange={e => setProfile({...profile, mnega_card: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{YES_NO.map(y => <option key={y}>{y}</option>)}</select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase">भूमि मालिक?</label>
                      <select value={profile.land_owner} onChange={e => setProfile({...profile, land_owner: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{YES_NO.map(y => <option key={y}>{y}</option>)}</select>
                    </div>
                  </FormSection>

                  <FormSection title="सरकारी सेवा" icon="💼">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase">स्वयं कर्मचारी?</label>
                      <select value={profile.is_govt_employee} onChange={e => setProfile({...profile, is_govt_employee: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{GOVT_SERVICE.map(g => <option key={g}>{g}</option>)}</select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase">परिवार में?</label>
                      <select value={profile.family_govt_employee} onChange={e => setProfile({...profile, family_govt_employee: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{GOVT_SERVICE.map(g => <option key={g}>{g}</option>)}</select>
                    </div>
                  </FormSection>

                  <FormSection title="IDs" icon="📋">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase">जन-आधार?</label>
                      <select value={profile.jan_aadhar_status} onChange={e => setProfile({...profile, jan_aadhar_status: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{YES_NO.map(y => <option key={y}>{y}</option>)}</select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase">बैंक DBT?</label>
                      <select value={profile.bank_account_dbt} onChange={e => setProfile({...profile, bank_account_dbt: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{YES_NO.map(y => <option key={y}>{y}</option>)}</select>
                    </div>
                  </FormSection>
                </div>

                <button type="submit" className="w-full py-6 bg-orange-600 text-white font-black rounded-3xl shadow-2xl hover:bg-orange-700 transition-all uppercase tracking-widest text-sm md:text-base">लाइव सरकारी वेबसाइटों से खोजें 🚀</button>
              </form>
            )}

            {loading && (
              <div className="py-24 text-center space-y-12 flex flex-col items-center justify-center">
                <div className="w-24 h-24 border-8 border-orange-100 border-t-orange-600 rounded-full animate-spin"></div>
                <div className="space-y-2">
                  <p className="font-black text-slate-800 text-2xl">सरकारी डेटा की लाइव जांच जारी है...</p>
                  <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Searching india.gov.in & rajasthan.gov.in</p>
                </div>
              </div>
            )}

            {result && !loading && (
              <div className="space-y-8 animate-slide-up mb-12">
                <div className="bg-white p-6 md:p-12 rounded-[3.5rem] shadow-2xl border border-slate-50">
                   <div className="flex justify-between items-center mb-10">
                     <h2 className="text-2xl font-black text-slate-800">खोज परिणाम ({result.eligible_schemes.length})</h2>
                     <button onClick={() => setResult(null)} className="px-6 py-2 bg-slate-100 text-slate-500 font-black rounded-xl text-[10px] uppercase">नया फॉर्म</button>
                   </div>
                   <div className="bg-orange-50/50 p-6 rounded-3xl mb-10 text-sm font-bold text-slate-700 border border-orange-100 whitespace-pre-wrap">
                      {result.hindiContent}
                   </div>
                   {result.eligible_schemes.length > 0 ? (
                     <SchemesTable schemes={result.eligible_schemes} />
                   ) : (
                     <div className="text-center py-20 bg-slate-50 rounded-3xl border-2 border-dashed">
                        <p className="text-slate-400 font-black">कोई डेटा नहीं मिला। कृपया अपनी API की जाँच करें।</p>
                     </div>
                   )}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'admin' && (
          <div className="max-w-xl mx-auto space-y-8">
            {!auth.isAuthenticated ? (
               <div className="bg-white p-12 rounded-[3.5rem] shadow-2xl border border-slate-50 text-center space-y-8">
                  <h2 className="text-2xl font-black text-slate-800">एडमिन लॉगिन</h2>
                  <form onSubmit={e => {
                    e.preventDefault();
                    if(loginForm.email === 'yadavnagji@gmail.com' && loginForm.password === '123456') setAuth({ isAuthenticated: true, user: 'Nagji' });
                    else alert("पहुंच वर्जित");
                  }} className="space-y-4">
                    <input type="email" required onChange={e => setLoginForm({...loginForm, email: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs" placeholder="Email" />
                    <input type="password" required onChange={e => setLoginForm({...loginForm, password: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs" placeholder="Password" />
                    <button type="submit" className="w-full py-4 bg-orange-600 text-white font-black rounded-2xl shadow-xl">लॉगिन</button>
                  </form>
               </div>
            ) : (
              <div className="bg-white p-10 rounded-[3.5rem] shadow-2xl space-y-12">
                <section className="space-y-6">
                  <h3 className="text-xs font-black uppercase text-slate-400">API कॉन्फ़िगरेशन</h3>
                  <div className="space-y-6">
                     <div className="flex flex-col gap-2">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Gemini API Key (Primary) {apiStatus.gemini === 'success' && '✅'}</label>
                        <div className="flex gap-2">
                          <input type="password" value={apiKeys.gemini} onChange={e => setApiKeys({...apiKeys, gemini: e.target.value})} className="flex-1 p-4 bg-slate-50 rounded-xl text-xs font-mono" />
                          <button onClick={() => checkApi('gemini')} className="px-4 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase">Test</button>
                        </div>
                     </div>
                     <div className="flex flex-col gap-2">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Groq API Key (Backup) {apiStatus.groq === 'success' && '✅'}</label>
                        <div className="flex gap-2">
                          <input type="password" value={apiKeys.groq} onChange={e => setApiKeys({...apiKeys, groq: e.target.value})} className="flex-1 p-4 bg-slate-50 rounded-xl text-xs font-mono" />
                          <button onClick={() => checkApi('groq')} className="px-4 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase">Test</button>
                        </div>
                     </div>
                     <button onClick={() => dbService.setSetting('api_keys', apiKeys).then(() => alert("कॉन्फ़िगरेशन सहेजा गया!"))} className="w-full py-4 bg-orange-600 text-white font-black rounded-2xl shadow-lg">Keys सेव करें</button>
                  </div>
                </section>
              </div>
            )}
          </div>
        )}
      </main>
      <footer className="py-8 text-center text-slate-400">
        <p className="text-[9px] font-black uppercase tracking-[0.4em]">Sarkari Master Engine • Nagji Yadav</p>
      </footer>
    </div>
  );
};

export default App;
