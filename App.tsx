
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
    ELIGIBLE: { bg: 'bg-green-100', text: 'text-green-700', label: '✅ पात्र' },
    NOT_ELIGIBLE: { bg: 'bg-red-100', text: 'text-red-700', label: '❌ अपात्र' },
    CONDITIONAL: { bg: 'bg-amber-100', text: 'text-amber-700', label: '⚠️ दस्तावेज़ आधारित' }
  };
  const { bg, text, label } = config[status || 'NOT_ELIGIBLE'];
  return <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${bg} ${text}`}>{label}</span>;
};

const SchemeCard: React.FC<{ scheme: Scheme }> = ({ scheme }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={`bg-white rounded-[2.5rem] border transition-all duration-300 overflow-hidden ${isOpen ? 'border-orange-500 shadow-2xl scale-[1.01]' : 'border-slate-100 shadow-sm hover:shadow-md'}`}>
      <div className="p-6 flex items-start justify-between cursor-pointer" onClick={() => setIsOpen(!isOpen)}>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-3">
            <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider ${scheme.government?.includes('Rajasthan') ? 'bg-orange-600 text-white' : 'bg-blue-600 text-white'}`}>{scheme.government}</span>
            <StatusBadge status={scheme.eligibility_status!} />
          </div>
          <h3 className="text-xl font-black text-slate-800 leading-tight mb-2">{scheme.yojana_name}</h3>
          <p className="text-xs text-slate-500 font-bold line-clamp-1">{scheme.short_purpose_hindi}</p>
        </div>
        <div className={`w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center transition-transform duration-500 ${isOpen ? 'rotate-180 bg-orange-50' : ''}`}>
          <span className={`text-xs ${isOpen ? 'text-orange-500' : 'text-slate-400'}`}>▼</span>
        </div>
      </div>
      
      {isOpen && (
        <div className="px-6 pb-8 pt-2 space-y-8 border-t border-slate-50 animate-slide-up">
          <section className="bg-orange-50/50 p-5 rounded-[2rem] border border-orange-100/50">
            <h4 className="text-[10px] font-black text-orange-600 uppercase tracking-widest mb-2 flex items-center gap-2">आप पात्र क्यों हैं?</h4>
            <p className="text-xs text-slate-700 font-bold leading-relaxed">{scheme.eligibility_reason_hindi}</p>
          </section>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">🎁 योजना के लाभ</h4>
              <p className="text-xs font-bold text-slate-800 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-100">{scheme.detailed_benefits}</p>
            </div>
            <div className="space-y-3">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">📄 जरूरी कागजात</h4>
              <ul className="grid grid-cols-1 gap-2">
                {(scheme.required_documents || []).map((doc, i) => (
                  <li key={i} className="text-[11px] font-bold text-slate-600 flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                    <span className="w-2 h-2 bg-green-500 rounded-full shrink-0"></span> {doc}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <section className="relative p-6 bg-slate-900 rounded-[2.5rem] text-white overflow-hidden">
            <h4 className="text-[11px] font-black text-orange-400 uppercase tracking-[0.2em] mb-6">आवेदन प्रक्रिया मार्गदर्शिका (Roadmap)</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center shrink-0 border border-orange-500/30 text-xs font-black">1</div>
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">हस्ताक्षर की आवश्यकता</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {(scheme.signatures_required || []).map((sig, i) => (
                        <span key={i} className="px-3 py-1 bg-white/10 rounded-full text-[10px] font-bold border border-white/10">{sig}</span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center shrink-0 border border-orange-500/30 text-xs font-black">2</div>
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">जमा करने का स्थान</p>
                    <p className="text-xs font-black text-white mt-1">{scheme.submission_point || 'ई-मित्र केंद्र'}</p>
                  </div>
                </div>
              </div>
              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center shrink-0 border border-orange-500/30 text-xs font-black">3</div>
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">आवेदन का प्रकार</p>
                    <p className="text-xs font-black text-white mt-1">{scheme.application_type || 'ऑनलाइन'}</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center shrink-0 border border-orange-500/30 text-xs font-black">4</div>
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">फॉर्म का स्रोत</p>
                    <p className="text-xs font-black text-white mt-1">{scheme.form_source || 'आधिकारिक पोर्टल'}</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-8 flex flex-col sm:flex-row gap-4 pt-6 border-t border-white/10">
              <a href={scheme.official_pdf_link || "#"} target="_blank" rel="noreferrer" className="flex-1 bg-white text-slate-900 py-4 rounded-2xl text-center text-[10px] font-black uppercase tracking-widest shadow-lg">फॉर्म डाउनलोड करें</a>
              <button className="flex-1 bg-orange-600 text-white py-4 rounded-2xl text-center text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-orange-700 transition-all">ई-मित्र पोर्टल</button>
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
    setResult(null);
    try {
      const res = await analyzeEligibility(profile, dummyMode);
      setResult(res);
    } catch (err: any) { 
      console.error(err);
      alert(err.message || "खोज विफल रही। API Keys जांचें।"); 
    } finally {
      setLoading(false);
    }
  };

  const handleAdminAutoFill = () => {
    setProfile({
      ...INITIAL_PROFILE,
      fullName: 'Sunita Devi', age: 33, gender: 'Female', marital_status: 'Married',
      district: 'Banswara', is_tsp_area: 'Yes', category: 'ST',
      income: INCOME_SLABS[0], bpl: 'Yes', ration_card_type: 'BPL',
      is_farmer: 'Yes', lactating: 'Yes', jan_aadhar_status: 'Yes'
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
               <p className="text-[9px] font-black text-orange-600 uppercase tracking-widest mt-1">AI Analyst 2024-2026</p>
             </div>
          </div>
          <nav className="flex bg-slate-100 p-1 rounded-2xl gap-1">
            <button onClick={() => setActiveTab('form')} className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase transition-all ${activeTab === 'form' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-400'}`}>आवेदन फॉर्म</button>
            <button onClick={() => setActiveTab('admin')} className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase transition-all ${activeTab === 'admin' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-400'}`}>एडमिन</button>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 flex-1 w-full">
        {activeTab === 'form' && (
          <div className="space-y-8 animate-slide-up">
            {!result && !loading && (
              <form onSubmit={handleAnalyze} className="bg-white p-6 md:p-12 rounded-[3.5rem] shadow-2xl border border-slate-50 space-y-12">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-black text-slate-800">पात्रता प्रोफाइल फॉर्म</h2>
                    <p className="text-xs font-bold text-slate-400 mt-1">योजनाओं की सटीक खोज के लिए सही विवरण भरें</p>
                  </div>
                  {dummyMode && <span className="px-3 py-1.5 bg-red-600 text-white rounded-full text-[10px] font-black uppercase">Test Mode</span>}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-y-10 gap-x-12">
                  <FormSection title="व्यक्तिगत विवरण" icon="👤">
                    <div className="space-y-2">
                      <label className="block text-[11px] font-black text-slate-500 uppercase ml-2">पूरा नाम (Full Name)</label>
                      <input type="text" value={profile.fullName} onChange={e => setProfile({...profile, fullName: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100 focus:ring-orange-500 outline-none" placeholder="उदा. राहुल कुमार" required />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="block text-[11px] font-black text-slate-500 uppercase ml-2">जन्म तिथि</label>
                        <input type="date" value={profile.dob} onChange={e => setProfile({...profile, dob: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100" />
                      </div>
                      <div className="space-y-2">
                        <label className="block text-[11px] font-black text-slate-500 uppercase ml-2">लिंग (Gender)</label>
                        <select value={profile.gender} onChange={e => setProfile({...profile, gender: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{GENDER.map(g => <option key={g}>{g}</option>)}</select>
                      </div>
                    </div>
                  </FormSection>

                  <FormSection title="स्थान और श्रेणी" icon="📍">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="block text-[11px] font-black text-slate-500 uppercase ml-2">जिला (District)</label>
                        <select value={profile.district} onChange={e => setProfile({...profile, district: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{RAJASTHAN_DISTRICTS.map(d => <option key={d}>{d}</option>)}</select>
                      </div>
                      <div className="space-y-2">
                        <label className="block text-[11px] font-black text-slate-500 uppercase ml-2">क्षेत्र</label>
                        <select value={profile.rural_or_urban} onChange={e => setProfile({...profile, rural_or_urban: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{RURAL_URBAN.map(r => <option key={r}>{r}</option>)}</select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-[11px] font-black text-slate-500 uppercase ml-2">जाति वर्ग (Category)</label>
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
                      <label className="block text-[11px] font-black text-slate-500 uppercase ml-2">शिक्षा का स्तर</label>
                      <select value={profile.education} onChange={e => setProfile({...profile, education: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{EDUCATION_LEVELS.map(e => <option key={e}>{e}</option>)}</select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="block text-[11px] font-black text-slate-500 uppercase ml-2">गर्भवती महिला?</label>
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
                      <label className="block text-[11px] font-black text-slate-500 uppercase ml-2">कार्य का प्रकार</label>
                      <select value={profile.employment_status} onChange={e => setProfile({...profile, employment_status: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{EMPLOYMENT_STATUS.map(s => <option key={s}>{s}</option>)}</select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="block text-[11px] font-black text-slate-500 uppercase ml-2">किसान?</label>
                        <select value={profile.is_farmer} onChange={e => setProfile({...profile, is_farmer: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{YES_NO.map(y => <option key={y}>{y}</option>)}</select>
                      </div>
                      <div className="space-y-2">
                        <label className="block text-[11px] font-black text-slate-500 uppercase ml-2">भूमि मालिक?</label>
                        <select value={profile.land_owner} onChange={e => setProfile({...profile, land_owner: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{YES_NO.map(y => <option key={y}>{y}</option>)}</select>
                      </div>
                    </div>
                  </FormSection>

                  <FormSection title="पेंशन और बैंक" icon="📋">
                    <div className="space-y-2">
                      <label className="block text-[11px] font-black text-slate-500 uppercase ml-2">पेंशन मिलती है?</label>
                      <select value={profile.pension_status} onChange={e => setProfile({...profile, pension_status: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{PENSION_STATUS.map(p => <option key={p}>{p}</option>)}</select>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-[11px] font-black text-slate-500 uppercase ml-2">DBT लिंक है?</label>
                      <select value={profile.bank_account_dbt} onChange={e => setProfile({...profile, bank_account_dbt: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{YES_NO.map(y => <option key={y}>{y}</option>)}</select>
                    </div>
                  </FormSection>
                </div>

                <div className="pt-6">
                  <button type="submit" className="w-full py-6 bg-orange-600 text-white font-black rounded-3xl shadow-xl hover:bg-orange-700 active:scale-95 transition-all text-sm md:text-base">योजनाएं खोजें 🚀</button>
                </div>
              </form>
            )}

            {loading && (
              <div className="py-24 text-center space-y-8 flex flex-col items-center justify-center">
                <div className="w-20 h-20 border-8 border-orange-100 border-t-orange-600 rounded-full animate-spin shadow-inner"></div>
                <div className="space-y-2">
                  <p className="font-black text-slate-800 text-lg">AI आपके लिए डेटा खोज रहा है...</p>
                  <p className="font-bold text-slate-400 uppercase text-[10px] tracking-[0.3em]">Checking 2024-25 & 2026 Schemes</p>
                </div>
              </div>
            )}

            {result && !loading && (
              <div className="space-y-8 animate-slide-up mb-12">
                <div className="bg-white p-6 md:p-12 rounded-[3.5rem] shadow-2xl border border-slate-50">
                   <div className="flex flex-col sm:flex-row justify-between items-center mb-10 gap-4">
                     <div>
                       <h2 className="text-2xl font-black text-slate-800">खोज परिणाम ({result.eligible_schemes.length})</h2>
                       <p className="text-xs font-bold text-slate-400 mt-1">आपकी जानकारी के आधार पर उपयुक्त योजनाएं</p>
                     </div>
                     <button onClick={() => setResult(null)} className="px-8 py-3 bg-slate-100 text-slate-500 font-black rounded-2xl text-[10px] uppercase">नई खोज</button>
                   </div>
                   <div className="bg-orange-50/50 p-6 md:p-8 rounded-[2.5rem] mb-10 text-sm font-bold text-slate-700 italic border border-orange-100/50 whitespace-pre-wrap shadow-inner leading-relaxed">
                      {result.hindiContent}
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {result.eligible_schemes.length > 0 ? (
                        result.eligible_schemes.map((s, idx) => <SchemeCard key={idx} scheme={s} />)
                      ) : (
                        <div className="col-span-1 md:col-span-2 text-center py-20 bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200">
                          <p className="text-xl font-black text-slate-300">कोई उपयुक्त योजना नहीं मिली।</p>
                        </div>
                      )}
                   </div>
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
                    else alert("पहुँच वर्जित");
                  }} className="space-y-4">
                    <input type="email" required onChange={e => setLoginForm({...loginForm, email: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100" placeholder="Email" />
                    <input type="password" required onChange={e => setLoginForm({...loginForm, password: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100" placeholder="Password" />
                    <button type="submit" className="w-full py-5 bg-orange-600 text-white font-black rounded-2xl">Login</button>
                  </form>
               </div>
            ) : (
              <div className="bg-white p-10 rounded-[3.5rem] shadow-2xl space-y-12 border border-slate-50">
                <button onClick={handleAdminAutoFill} className="w-full py-6 bg-orange-600 text-white font-black rounded-3xl shadow-lg">🚀 Auto-Fill Profile (Test)</button>
                <section className="space-y-6 pt-8 border-t border-slate-100">
                  <h3 className="text-xs font-black uppercase text-slate-400">API Settings</h3>
                  <div className="space-y-4">
                     <input type="password" value={apiKeys.gemini} onChange={e => setApiKeys({...apiKeys, gemini: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-mono text-[11px] ring-1 ring-slate-200" placeholder="Gemini Key" />
                     <input type="password" value={apiKeys.groq} onChange={e => setApiKeys({...apiKeys, groq: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-mono text-[11px] ring-1 ring-slate-200" placeholder="Groq Key (gsk_...)" />
                     <button onClick={() => dbService.setSetting('api_keys', apiKeys).then(() => alert("Saved!"))} className="w-full py-4 bg-slate-900 text-white font-black rounded-2xl">Save Settings</button>
                  </div>
                </section>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="py-8 text-center bg-white border-t border-slate-100 shrink-0 mt-auto w-full">
        <p className="opacity-30 text-[9px] font-black uppercase tracking-[0.4em]">Sarkari Master Engine • Dual AI (Gemini + Groq) • 2024-2026</p>
      </footer>
    </div>
  );
};

export default App;
