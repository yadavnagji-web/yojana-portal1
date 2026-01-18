
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
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">पात्रता का मुख्य कारण</h4>
            <p className="text-xs text-slate-700 font-bold leading-relaxed bg-orange-50 p-4 rounded-2xl border border-orange-100/50">{scheme.eligibility_reason_hindi}</p>
          </section>

          <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">योजना के फायदे (Benefits)</h4>
              <p className="text-xs font-bold text-slate-800 leading-relaxed">{scheme.detailed_benefits}</p>
            </div>
            <div>
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">जरूरी कागजात (Documents)</h4>
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
            <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2">📝 आवेदन की विस्तृत प्रक्रिया</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="space-y-3">
                <p><span className="text-slate-400 font-black uppercase text-[9px]">फॉर्म कहाँ से प्राप्त करें:</span><br/><b>{scheme.form_source || 'ई-मित्र (e-Mitra) केंद्र या विभाग की वेबसाइट'}</b></p>
                <p><span className="text-slate-400 font-black uppercase text-[9px]">आवेदन का प्रकार:</span><br/><b>{scheme.application_type || 'ऑनलाइन (Online)'}</b></p>
              </div>
              <div className="space-y-3">
                <p><span className="text-slate-400 font-black uppercase text-[9px]">जरूरी हस्ताक्षर:</span><br/><b>{scheme.signatures_required?.join(', ') || 'स्वयं के हस्ताक्षर'}</b></p>
                <p><span className="text-slate-400 font-black uppercase text-[9px]">जमा करने का स्थान:</span><br/><b>{scheme.submission_point || 'नजदीकी ई-मित्र केंद्र'}</b></p>
              </div>
            </div>
            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <a href={scheme.official_pdf_link || "#"} target="_blank" rel="noreferrer" className="flex-1 bg-white border-2 border-slate-200 text-slate-800 py-3.5 rounded-2xl text-center text-xs font-black hover:border-orange-500 transition-all shadow-sm">Official Form PDF</a>
              <button className="flex-1 bg-orange-600 text-white py-3.5 rounded-2xl text-center text-xs font-black shadow-lg hover:bg-orange-700 active:scale-95 transition-all">ई-मित्र पर आवेदन करें</button>
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
      alert(err.message || "खोज विफल रही। कृपया API Keys की जांच करें।"); 
    } finally {
      setLoading(false);
    }
  };

  const handleAdminAutoFill = () => {
    setProfile({
      ...INITIAL_PROFILE,
      fullName: 'Sumitra Devi', age: 32, gender: 'Female', marital_status: 'Married',
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
               <p className="text-[9px] font-black text-orange-600 uppercase tracking-widest mt-1">Dual AI Engine (2024-2026)</p>
             </div>
          </div>
          <nav className="flex bg-slate-100 p-1 rounded-2xl gap-1">
            <button onClick={() => setActiveTab('form')} className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase transition-all ${activeTab === 'form' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-400'}`}>Form</button>
            <button onClick={() => setActiveTab('admin')} className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase transition-all ${activeTab === 'admin' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-400'}`}>Admin</button>
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
                    <p className="text-xs font-bold text-slate-400 mt-1">2024-2026 की सभी योजनाओं की जांच हेतु सम्पूर्ण विवरण दें</p>
                  </div>
                  {dummyMode && <span className="px-3 py-1.5 bg-red-600 text-white rounded-full text-[10px] font-black uppercase animate-pulse">Test Mode Enabled</span>}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-y-10 gap-x-12">
                  <FormSection title="व्यक्तिगत विवरण" icon="👤">
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-black text-slate-400 uppercase ml-2">पूरा नाम (Full Name)</label>
                      <input type="text" value={profile.fullName} onChange={e => setProfile({...profile, fullName: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100 focus:ring-orange-500 outline-none" placeholder="उदा. राहुल कुमार" required />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-black text-slate-400 uppercase ml-2">जन्म तिथि</label>
                        <input type="date" value={profile.dob} onChange={e => setProfile({...profile, dob: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-black text-slate-400 uppercase ml-2">लिंग (Gender)</label>
                        <select value={profile.gender} onChange={e => setProfile({...profile, gender: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{GENDER.map(g => <option key={g}>{g}</option>)}</select>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-black text-slate-400 uppercase ml-2">वैवाहिक स्थिति</label>
                      <select value={profile.marital_status} onChange={e => setProfile({...profile, marital_status: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{MARITAL_STATUS.map(m => <option key={m}>{m}</option>)}</select>
                    </div>
                  </FormSection>

                  <FormSection title="स्थान और श्रेणी" icon="📍">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-black text-slate-400 uppercase ml-2">जिला</label>
                        <select value={profile.district} onChange={e => setProfile({...profile, district: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{RAJASTHAN_DISTRICTS.map(d => <option key={d}>{d}</option>)}</select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-black text-slate-400 uppercase ml-2">क्षेत्र</label>
                        <select value={profile.rural_or_urban} onChange={e => setProfile({...profile, rural_or_urban: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{RURAL_URBAN.map(r => <option key={r}>{r}</option>)}</select>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-black text-slate-400 uppercase ml-2">जाति वर्ग (Category)</label>
                      <select value={profile.category} onChange={e => setProfile({...profile, category: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-black text-slate-400 uppercase ml-2">TSP क्षेत्र?</label>
                        <select value={profile.is_tsp_area} onChange={e => setProfile({...profile, is_tsp_area: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{YES_NO.map(y => <option key={y}>{y}</option>)}</select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-black text-slate-400 uppercase ml-2">अल्पसंख्यक?</label>
                        <select value={profile.minority} onChange={e => setProfile({...profile, minority: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{YES_NO.map(y => <option key={y}>{y}</option>)}</select>
                      </div>
                    </div>
                  </FormSection>

                  <FormSection title="आर्थिक और दस्तावेज" icon="💰">
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-black text-slate-400 uppercase ml-2">सालाना पारिवारिक आय</label>
                      <select value={profile.income} onChange={e => setProfile({...profile, income: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{INCOME_SLABS.map(s => <option key={s}>{s}</option>)}</select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-black text-slate-400 uppercase ml-2">राशन कार्ड</label>
                        <select value={profile.ration_card_type} onChange={e => setProfile({...profile, ration_card_type: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{RATION_CARD_TYPES.map(r => <option key={r}>{r}</option>)}</select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-black text-slate-400 uppercase ml-2">BPL कार्ड है?</label>
                        <select value={profile.bpl} onChange={e => setProfile({...profile, bpl: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{YES_NO.map(y => <option key={y}>{y}</option>)}</select>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-black text-slate-400 uppercase ml-2">जन-आधार लिंक है?</label>
                      <select value={profile.jan_aadhar_status} onChange={e => setProfile({...profile, jan_aadhar_status: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{YES_NO.map(y => <option key={y}>{y}</option>)}</select>
                    </div>
                  </FormSection>

                  <FormSection title="शिक्षा और स्वास्थ्य" icon="🎓">
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-black text-slate-400 uppercase ml-2">शिक्षा का स्तर</label>
                      <select value={profile.education} onChange={e => setProfile({...profile, education: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{EDUCATION_LEVELS.map(e => <option key={e}>{e}</option>)}</select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-black text-slate-400 uppercase ml-2">गर्भवती महिला?</label>
                        <select value={profile.pregnant} onChange={e => setProfile({...profile, pregnant: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{YES_NO.map(y => <option key={y}>{y}</option>)}</select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-black text-slate-400 uppercase ml-2">धात्री माता?</label>
                        <select value={profile.lactating} onChange={e => setProfile({...profile, lactating: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{YES_NO.map(y => <option key={y}>{y}</option>)}</select>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-black text-slate-400 uppercase ml-2">दिव्यांगता (%)</label>
                      <div className="flex gap-2">
                        <select value={profile.disability} onChange={e => setProfile({...profile, disability: e.target.value})} className="flex-1 p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{YES_NO.map(y => <option key={y}>{y}</option>)}</select>
                        <input type="number" value={profile.disability_percent} onChange={e => setProfile({...profile, disability_percent: e.target.value})} className="w-24 p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100" placeholder="%" />
                      </div>
                    </div>
                  </FormSection>

                  <FormSection title="व्यवसाय और किसान" icon="🚜">
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-black text-slate-400 uppercase ml-2">कार्य का प्रकार</label>
                      <select value={profile.employment_status} onChange={e => setProfile({...profile, employment_status: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{EMPLOYMENT_STATUS.map(s => <option key={s}>{s}</option>)}</select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-black text-slate-400 uppercase ml-2">क्या आप किसान हैं?</label>
                        <select value={profile.is_farmer} onChange={e => setProfile({...profile, is_farmer: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{YES_NO.map(y => <option key={y}>{y}</option>)}</select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-black text-slate-400 uppercase ml-2">स्वयं की भूमि?</label>
                        <select value={profile.land_owner} onChange={e => setProfile({...profile, land_owner: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{YES_NO.map(y => <option key={y}>{y}</option>)}</select>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-black text-slate-400 uppercase ml-2">PM किसान लाभार्थी?</label>
                      <select value={profile.pm_kisan_beneficiary} onChange={e => setProfile({...profile, pm_kisan_beneficiary: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{YES_NO.map(y => <option key={y}>{y}</option>)}</select>
                    </div>
                  </FormSection>

                  <FormSection title="पेंशन और अन्य" icon="📋">
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-black text-slate-400 uppercase ml-2">पेंशन का प्रकार</label>
                      <select value={profile.pension_status} onChange={e => setProfile({...profile, pension_status: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{PENSION_STATUS.map(p => <option key={p}>{p}</option>)}</select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-black text-slate-400 uppercase ml-2">सरकारी नौकरी?</label>
                      <select value={profile.is_govt_employee} onChange={e => setProfile({...profile, is_govt_employee: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{GOVT_SERVICE.map(s => <option key={s}>{s}</option>)}</select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-black text-slate-400 uppercase ml-2">बैंक में DBT लिंक?</label>
                      <select value={profile.bank_account_dbt} onChange={e => setProfile({...profile, bank_account_dbt: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{YES_NO.map(y => <option key={y}>{y}</option>)}</select>
                    </div>
                  </FormSection>
                </div>

                <div className="pt-6">
                  <button type="submit" className="w-full py-6 bg-orange-600 text-white font-black rounded-3xl shadow-xl uppercase tracking-widest hover:bg-orange-700 transition-all active:scale-95 text-sm md:text-base">पात्रता और योजनाएं खोजें 🚀</button>
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
              <div className="space-y-8 animate-slide-up mb-20">
                <div className="bg-white p-6 md:p-12 rounded-[3.5rem] shadow-2xl border border-slate-50">
                   <div className="flex flex-col sm:flex-row justify-between items-center mb-10 gap-4">
                     <div>
                       <h2 className="text-2xl font-black text-slate-800">खोज परिणाम ({result.eligible_schemes.length})</h2>
                       <p className="text-xs font-bold text-slate-400 mt-1">आपकी प्रोफाइल के आधार पर चुनी गई योजनाएं</p>
                     </div>
                     <button onClick={() => setResult(null)} className="px-8 py-3 bg-slate-100 text-slate-500 font-black rounded-2xl text-[10px] uppercase hover:bg-orange-50 hover:text-orange-600 transition-all">नया आवेदन जांचें</button>
                   </div>
                   
                   <div className="bg-orange-50/50 p-6 md:p-8 rounded-[2.5rem] mb-10 text-sm font-bold text-slate-700 italic border border-orange-100/50 whitespace-pre-wrap shadow-inner leading-relaxed">
                      {result.hindiContent}
                   </div>

                   {result.groundingSources && result.groundingSources.length > 0 && (
                     <div className="mb-10 p-5 bg-blue-50/50 rounded-3xl border border-blue-100">
                        <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                          <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span> आधिकारिक नीति सूत्र (Policy Sources):
                        </h4>
                        <div className="flex flex-wrap gap-2">
                           {result.groundingSources.map((source: any, i: number) => (
                             <a key={i} href={source.web?.uri} target="_blank" rel="noreferrer" className="px-4 py-2 bg-white border border-blue-200 rounded-xl text-[10px] font-bold text-blue-700 hover:bg-blue-100 transition-all shadow-sm">
                               {source.web?.title || 'Govt Portal'}
                             </a>
                           ))}
                        </div>
                     </div>
                   )}

                   <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {result.eligible_schemes.length > 0 ? (
                        result.eligible_schemes.map((s, idx) => <SchemeCard key={idx} scheme={s} />)
                      ) : (
                        <div className="col-span-1 md:col-span-2 text-center py-20 bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200">
                          <p className="text-xl font-black text-slate-300">कोई सीधी योजना नहीं मिली।</p>
                          <p className="text-xs font-bold text-slate-400 mt-2">कृपया Admin में API Key चेक करें या प्रोफाइल विवरण बदलें।</p>
                        </div>
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
               <div className="bg-white p-12 rounded-[3.5rem] shadow-2xl text-center space-y-8 border border-slate-50">
                  <div className="w-16 h-16 bg-slate-100 rounded-3xl mx-auto flex items-center justify-center text-2xl">🔐</div>
                  <h2 className="text-2xl font-black text-slate-800">Admin Login</h2>
                  <form onSubmit={e => {
                    e.preventDefault();
                    if(loginForm.email === 'yadavnagji@gmail.com' && loginForm.password === '123456') setAuth({ isAuthenticated: true, user: 'Nagji' });
                    else alert("Access Denied: Wrong Credentials");
                  }} className="space-y-4">
                    <input type="email" required onChange={e => setLoginForm({...loginForm, email: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100 outline-none focus:ring-orange-500" placeholder="Admin Email" />
                    <input type="password" required onChange={e => setLoginForm({...loginForm, password: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100 outline-none focus:ring-orange-500" placeholder="Password" />
                    <button type="submit" className="w-full py-5 bg-orange-600 text-white font-black rounded-2xl shadow-xl hover:bg-orange-700 transition-all">Secure Login</button>
                  </form>
               </div>
            ) : (
              <div className="bg-white p-10 rounded-[3.5rem] shadow-2xl space-y-12 border border-slate-50">
                <div className="flex justify-between items-center pb-6 border-b">
                   <h2 className="text-xl font-black text-slate-800">Admin Controls</h2>
                   <button onClick={() => setAuth({isAuthenticated: false, user: null})} className="text-[10px] font-black text-red-500 uppercase hover:underline">Logout</button>
                </div>
                
                <section className="space-y-6">
                  <button onClick={handleAdminAutoFill} className="w-full py-6 bg-gradient-to-r from-orange-500 to-orange-700 text-white font-black rounded-3xl shadow-lg hover:scale-[1.02] transition-all">🚀 Auto-Fill Realistic Test Data</button>
                  <div className="flex items-center justify-between p-6 bg-slate-50 rounded-3xl border border-slate-100">
                    <div>
                      <span className="font-black text-xs text-slate-800 block">Dummy Mode (No Logging)</span>
                      <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">Prevents saving test data to DB</p>
                    </div>
                    <input type="checkbox" checked={dummyMode} onChange={async (e) => {
                      const val = e.target.checked;
                      setDummyMode(val);
                      await dbService.setSetting('dummy_mode', val);
                    }} className="w-8 h-8 accent-orange-600 cursor-pointer" />
                  </div>
                </section>

                <section className="space-y-6 pt-8 border-t border-slate-100">
                  <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest">API Configuration</h3>
                  <div className="space-y-4">
                     <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase ml-3">Gemini 3 Pro Key</label>
                        <input type="password" value={apiKeys.gemini} onChange={e => setApiKeys({...apiKeys, gemini: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-mono text-[11px] ring-1 ring-slate-200 focus:ring-orange-500 outline-none" placeholder="API Key Here" />
                     </div>
                     <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase ml-3">Groq (Llama-3) Key</label>
                        <input type="password" value={apiKeys.groq} onChange={e => setApiKeys({...apiKeys, groq: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-mono text-[11px] ring-1 ring-slate-200 focus:ring-orange-500 outline-none" placeholder="gsk_..." />
                     </div>
                     <button onClick={() => dbService.setSetting('api_keys', apiKeys).then(() => alert("Keys Securely Saved!"))} className="w-full py-4 bg-slate-900 text-white font-black rounded-2xl shadow-xl hover:bg-black transition-all">Save Persistent Settings</button>
                  </div>
                </section>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="py-8 text-center bg-white border-t border-slate-100 shrink-0 mt-auto">
        <p className="opacity-30 text-[9px] font-black uppercase tracking-[0.4em]">Sarkari Master Engine • Dual AI Verified (2.0) • 2024-2026 Data Ready</p>
      </footer>
    </div>
  );
};

export default App;
