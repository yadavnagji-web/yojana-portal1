
import React, { useState, useRef, useEffect } from 'react';
import { UserProfile, AnalysisResponse, Scheme, AuthState, AIAgentLog } from './types';
import { 
  RAJASTHAN_DISTRICTS, 
  TSP_DISTRICTS, 
  CATEGORIES, 
  BENEFICIARY_TYPES, 
  GENDER, 
  MARITAL_STATUS, 
  AREA_TYPE, 
  YES_NO, 
  RATION_CARD_TYPES, 
  PENSION_TYPES, 
  PARENT_STATUS,
  EDUCATION_LEVELS,
  OCCUPATIONS
} from './constants';
import FormSection from './components/FormSection';
import { analyzeEligibility, fetchMasterSchemes, proposeSystemImprovement } from './services/geminiService';
import { dbService } from './services/dbService';

const SchemeCard: React.FC<{ scheme: Scheme; isBookmarked: boolean; onToggle: () => void }> = ({ scheme, isBookmarked, onToggle }) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className={`bg-white rounded-3xl border transition-all duration-300 overflow-hidden ${isOpen ? 'border-orange-500 shadow-2xl' : 'border-slate-100 shadow-sm hover:shadow-md'}`}>
      <div className="p-5 flex items-start justify-between cursor-pointer" onClick={() => setIsOpen(!isOpen)}>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider ${scheme.government.includes('Rajasthan') ? 'bg-orange-600 text-white' : 'bg-blue-600 text-white'}`}>
              {scheme.government}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase bg-slate-100 text-slate-500`}>{scheme.scheme_status}</span>
          </div>
          <h3 className="text-base font-black text-slate-800 leading-tight">{scheme.yojana_name}</h3>
          <p className="text-xs text-slate-500 mt-1 line-clamp-1">{scheme.short_purpose_hindi}</p>
        </div>
        <button onClick={(e) => { e.stopPropagation(); onToggle(); }} className={`p-2 rounded-full transition-colors ${isBookmarked ? 'text-red-500 bg-red-50' : 'text-slate-300 hover:bg-slate-50'}`}>
          <svg className="w-5 h-5" fill={isBookmarked ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
        </button>
      </div>
      {isOpen && (
        <div className="px-5 pb-5 pt-2 border-t border-slate-50 animate-in slide-in-from-top-2">
          <div className="space-y-4">
            <div>
              <h4 className="text-[10px] font-black text-orange-600 uppercase tracking-widest mb-2">विस्तृत लाभ</h4>
              <p className="text-xs text-slate-700 font-bold leading-relaxed">{scheme.detailed_benefits}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">दस्तावेज</h4>
                <ul className="text-[10px] text-slate-600 list-disc pl-4 font-bold">
                  {scheme.required_documents.map((d, i) => <li key={i}>{d}</li>)}
                </ul>
              </div>
              <div>
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">पात्रता</h4>
                <ul className="text-[10px] text-slate-600 list-disc pl-4 font-bold">
                  {scheme.eligibility.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <a href={scheme.online_apply_link} target="_blank" rel="noreferrer" className="flex-1 bg-orange-600 text-white py-2.5 rounded-xl text-[10px] font-black text-center shadow-lg hover:bg-orange-700">Apply Now</a>
              {scheme.official_pdf_link && <a href={scheme.official_pdf_link} target="_blank" rel="noreferrer" className="flex-1 bg-slate-100 text-slate-600 py-2.5 rounded-xl text-[10px] font-black text-center hover:bg-slate-200">Official Info</a>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'check' | 'browse' | 'saved' | 'admin'>('check');
  const [profile, setProfile] = useState<UserProfile>({
    gender: 'Female', age: '30', marital_status: 'Married', state: 'Rajasthan', district: 'Jaipur', rural_or_urban: 'Rural', is_tsp_area: 'No',
    category: 'General', beneficiary_type: 'Woman', minority: 'No', disability: 'No', disability_percent: '0', income: '150000', bpl: 'No',
    education: 'Graduate', occupation: 'Housewife', labour_card: 'No', pregnant: 'No', lactating: 'No', family_count: '4', head_of_family: 'Yes',
    jan_aadhar_status: 'Yes', ration_card_type: 'APL', pension_status: 'None', parent_status: 'Both Alive',
    children_before_2002: '0', children_after_2002: '0', land_owner: 'No', current_class: 'N/A'
  });

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [auth, setAuth] = useState<AuthState>({ isAuthenticated: false, user: null });
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [apiKeys, setApiKeys] = useState({ gemini: '', groq: '', openai: '', claude: '' });
  const [masterSchemes, setMasterSchemes] = useState<Scheme[]>([]);
  const [bookmarks, setBookmarks] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Initial Data Load
  useEffect(() => {
    const init = async () => {
      await dbService.init();
      const savedKeys = await dbService.getSetting<typeof apiKeys>('api_keys');
      if (savedKeys) setApiKeys(savedKeys);
      
      const localSchemes = await dbService.getAllSchemes();
      setMasterSchemes(localSchemes);

      const savedMarks = localStorage.getItem('scheme_bookmarks');
      if (savedMarks) setBookmarks(JSON.parse(savedMarks));
    };
    init();
  }, []);

  // Logical Auto-Updates
  useEffect(() => {
    // 1. TSP Auto-Detection
    if (TSP_DISTRICTS.includes(profile.district)) {
      setProfile(p => ({ ...p, is_tsp_area: 'Yes' }));
    } else {
      setProfile(p => ({ ...p, is_tsp_area: 'No' }));
    }
  }, [profile.district]);

  // Dynamic Filtering for Marital Status Options
  const maritalOptions = profile.gender === 'Male' 
    ? MARITAL_STATUS.filter(m => m !== 'Widowed') // Using common terms: Men are Widowers, but govt forms often use "Widow" for women
    : MARITAL_STATUS;

  // Filter Beneficiary Types based on logical gender
  const filteredBeneficiaryTypes = BENEFICIARY_TYPES.filter(type => {
    if (profile.gender === 'Male' && (type === 'Widow' || type === 'Woman' || type === 'Girl Child')) return false;
    return true;
  });

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await analyzeEligibility(profile);
      setResult(res);
    } catch (err: any) {
      alert(err.message);
      if (err.message.includes("API Key")) setActiveTab('admin');
    }
    setLoading(false);
  };

  const saveConfig = async () => {
    await dbService.setSetting('api_keys', apiKeys);
    alert("API Key browser mein hamesha ke liye save ho gayi hai.");
  };

  const handleBookmark = (name: string) => {
    const newMarks = bookmarks.includes(name) ? bookmarks.filter(n => n !== name) : [...bookmarks, name];
    setBookmarks(newMarks);
    localStorage.setItem('scheme_bookmarks', JSON.stringify(newMarks));
  };

  return (
    <div className="min-h-screen bg-[#FDFDFD] font-sans">
      <header className="bg-white/90 backdrop-blur-md border-b border-slate-100 sticky top-0 z-50 py-3 px-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-orange-600 rounded-xl flex items-center justify-center text-xl shadow-lg">🇮🇳</div>
             <div>
               <h1 className="text-lg font-black text-slate-800 leading-none">Sarkari Yojana AI</h1>
               <p className="text-[10px] font-black text-orange-600 uppercase tracking-widest mt-1">Smart Eligibility Checker</p>
             </div>
          </div>
          <nav className="flex bg-slate-100 p-1 rounded-2xl gap-1">
            {[
              { id: 'check', label: 'पात्रता', icon: '🔍' },
              { id: 'browse', label: 'योजनाएं', icon: '📑' },
              { id: 'saved', label: 'Saved', icon: '💖' },
              { id: 'admin', label: 'Admin', icon: '⚙️' }
            ].map(tab => (
              <button 
                key={tab.id} onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase transition-all flex items-center gap-2 ${activeTab === tab.id ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              >
                <span>{tab.icon}</span> {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {activeTab === 'check' && (
          <div className="space-y-8">
             {!result && !loading && (
               <form onSubmit={handleAnalyze} className="bg-white p-8 rounded-[2rem] shadow-xl border border-slate-50 space-y-8 animate-slide-up">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    
                    <FormSection title="व्यक्तिगत प्रोफाइल" icon="👤">
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <label className="block">
                            <span className="text-[10px] font-black text-slate-400 uppercase">लिंग</span>
                            <select value={profile.gender} onChange={e => setProfile({...profile, gender: e.target.value})} className="w-full mt-1 p-3 bg-slate-50 border-0 rounded-xl font-bold text-xs">
                              {GENDER.map(g => <option key={g} value={g}>{g}</option>)}
                            </select>
                          </label>
                          <label className="block">
                            <span className="text-[10px] font-black text-slate-400 uppercase">आयु</span>
                            <input type="number" value={profile.age} onChange={e => setProfile({...profile, age: e.target.value})} className="w-full mt-1 p-3 bg-slate-50 border-0 rounded-xl font-bold text-xs" />
                          </label>
                        </div>
                        <label className="block">
                          <span className="text-[10px] font-black text-slate-400 uppercase">शादी की स्थिति</span>
                          <select value={profile.marital_status} onChange={e => setProfile({...profile, marital_status: e.target.value})} className="w-full mt-1 p-3 bg-slate-50 border-0 rounded-xl font-bold text-xs">
                            {maritalOptions.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </label>
                        <label className="block">
                          <span className="text-[10px] font-black text-slate-400 uppercase">लाभार्थी श्रेणी</span>
                          <select value={profile.beneficiary_type} onChange={e => setProfile({...profile, beneficiary_type: e.target.value})} className="w-full mt-1 p-3 bg-slate-50 border-0 rounded-xl font-bold text-xs">
                            {filteredBeneficiaryTypes.map(b => <option key={b} value={b}>{b}</option>)}
                          </select>
                        </label>
                      </div>
                    </FormSection>

                    <FormSection title="स्थान एवं पहचान" icon="📍">
                      <div className="space-y-4">
                        <label className="block">
                          <span className="text-[10px] font-black text-slate-400 uppercase">जिला</span>
                          <select value={profile.district} onChange={e => setProfile({...profile, district: e.target.value})} className="w-full mt-1 p-3 bg-slate-50 border-0 rounded-xl font-bold text-xs">
                            {RAJASTHAN_DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
                          </select>
                        </label>
                        <div className="grid grid-cols-2 gap-4">
                          <label className="block">
                            <span className="text-[10px] font-black text-slate-400 uppercase">TSP क्षेत्र</span>
                            <input disabled value={profile.is_tsp_area} className="w-full mt-1 p-3 bg-slate-100 border-0 rounded-xl font-bold text-xs text-orange-600" />
                          </label>
                          <label className="block">
                            <span className="text-[10px] font-black text-slate-400 uppercase">Jan-Aadhar</span>
                            <select value={profile.jan_aadhar_status} onChange={e => setProfile({...profile, jan_aadhar_status: e.target.value})} className="w-full mt-1 p-3 bg-slate-50 border-0 rounded-xl font-bold text-xs">
                              {YES_NO.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                          </label>
                        </div>
                        <label className="block">
                          <span className="text-[10px] font-black text-slate-400 uppercase">राशन कार्ड टाइप</span>
                          <select value={profile.ration_card_type} onChange={e => setProfile({...profile, ration_card_type: e.target.value})} className="w-full mt-1 p-3 bg-slate-50 border-0 rounded-xl font-bold text-xs">
                            {RATION_CARD_TYPES.map(r => <option key={r} value={r}>{r}</option>)}
                          </select>
                        </label>
                      </div>
                    </FormSection>

                    <FormSection title="परिवार एवं आर्थिक" icon="💰">
                      <div className="space-y-4">
                         <div className="grid grid-cols-2 gap-4">
                            <label className="block">
                               <span className="text-[8px] font-black text-slate-400 uppercase">बच्चे (Pre-2002)</span>
                               <input type="number" value={profile.children_before_2002} onChange={e => setProfile({...profile, children_before_2002: e.target.value})} className="w-full mt-1 p-3 bg-slate-50 border-0 rounded-xl font-bold text-xs" />
                            </label>
                            <label className="block">
                               <span className="text-[8px] font-black text-slate-400 uppercase">बच्चे (Post-2002)</span>
                               <input type="number" value={profile.children_after_2002} onChange={e => setProfile({...profile, children_after_2002: e.target.value})} className="w-full mt-1 p-3 bg-slate-50 border-0 rounded-xl font-bold text-xs" />
                            </label>
                         </div>
                         <label className="block">
                            <span className="text-[10px] font-black text-slate-400 uppercase">वर्तमान पेंशन स्थिति</span>
                            <select value={profile.pension_status} onChange={e => setProfile({...profile, pension_status: e.target.value})} className="w-full mt-1 p-3 bg-slate-50 border-0 rounded-xl font-bold text-xs">
                              {PENSION_TYPES.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                         </label>
                         <label className="block">
                            <span className="text-[10px] font-black text-slate-400 uppercase">वार्षिक आय</span>
                            <input type="number" value={profile.income} onChange={e => setProfile({...profile, income: e.target.value})} className="w-full mt-1 p-3 bg-slate-50 border-0 rounded-xl font-bold text-xs" />
                         </label>
                      </div>
                    </FormSection>

                    {/* Conditional Logic: Student */}
                    {profile.beneficiary_type === 'Student' && (
                      <FormSection title="विद्यार्थी विवरण" icon="🎓">
                         <div className="space-y-4">
                            <label className="block">
                               <span className="text-[10px] font-black text-slate-400 uppercase">अभिभावक स्थिति</span>
                               <select value={profile.parent_status} onChange={e => setProfile({...profile, parent_status: e.target.value})} className="w-full mt-1 p-3 bg-slate-50 border-0 rounded-xl font-bold text-xs">
                                 {PARENT_STATUS.map(p => <option key={p} value={p}>{p}</option>)}
                               </select>
                            </label>
                            <label className="block">
                               <span className="text-[10px] font-black text-slate-400 uppercase">वर्तमान कक्षा</span>
                               <input type="text" value={profile.current_class} onChange={e => setProfile({...profile, current_class: e.target.value})} className="w-full mt-1 p-3 bg-slate-50 border-0 rounded-xl font-bold text-xs" />
                            </label>
                         </div>
                      </FormSection>
                    )}

                    {/* Conditional Logic: Farmer */}
                    {profile.beneficiary_type === 'Farmer' && (
                      <FormSection title="कृषि विवरण" icon="🚜">
                         <div className="space-y-4">
                            <label className="block">
                               <span className="text-[10px] font-black text-slate-400 uppercase">स्वयं की भूमि?</span>
                               <select value={profile.land_owner} onChange={e => setProfile({...profile, land_owner: e.target.value})} className="w-full mt-1 p-3 bg-slate-50 border-0 rounded-xl font-bold text-xs">
                                 {YES_NO.map(y => <option key={y} value={y}>{y}</option>)}
                               </select>
                            </label>
                         </div>
                      </FormSection>
                    )}

                  </div>
                  
                  <button type="submit" disabled={loading} className="w-full py-5 bg-orange-600 text-white font-black rounded-3xl shadow-lg hover:bg-orange-700 transition-all uppercase tracking-widest text-sm disabled:opacity-50">
                    {loading ? 'Analyzing with AI...' : 'योजनाएं खोजें 🔍'}
                  </button>
               </form>
             )}

             {loading && (
               <div className="py-20 text-center space-y-4">
                  <div className="w-12 h-12 border-4 border-orange-100 border-t-orange-600 rounded-full animate-spin mx-auto"></div>
                  <p className="font-black text-slate-400 uppercase text-[10px] tracking-widest">AI analysis in progress...</p>
               </div>
             )}

             {result && !loading && (
               <div className="space-y-8 animate-slide-up">
                 <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-slate-100">
                   <div className="flex items-center justify-between mb-8">
                     <h2 className="text-xl font-black text-slate-800">पात्र योजनाएं ({result.eligible_schemes.length})</h2>
                     <button onClick={() => setResult(null)} className="text-[10px] font-black text-orange-600 bg-orange-50 px-4 py-2 rounded-xl">नया सर्च</button>
                   </div>
                   <div className="bg-slate-50 p-6 rounded-2xl mb-8 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap font-medium border border-slate-100">
                      {result.hindiContent}
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {result.eligible_schemes.map((s, idx) => (
                        <SchemeCard key={idx} scheme={s} isBookmarked={bookmarks.includes(s.yojana_name)} onToggle={() => handleBookmark(s.yojana_name)} />
                      ))}
                   </div>
                 </div>
               </div>
             )}
          </div>
        )}

        {activeTab === 'browse' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <input type="text" placeholder="योजना खोजें..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full md:max-w-md p-4 bg-white border border-slate-100 rounded-2xl shadow-sm focus:ring-2 focus:ring-orange-500 text-sm font-bold" />
              <button onClick={() => fetchMasterSchemes('Rajasthan').then(refresh => setMasterSchemes(refresh))} className="px-6 py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase">Force Refresh 🔄</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {masterSchemes.filter(s => s.yojana_name.toLowerCase().includes(searchTerm.toLowerCase())).map((s, idx) => (
                <SchemeCard key={idx} scheme={s} isBookmarked={bookmarks.includes(s.yojana_name)} onToggle={() => handleBookmark(s.yojana_name)} />
              ))}
            </div>
          </div>
        )}

        {activeTab === 'saved' && (
          <div className="space-y-8">
            <h2 className="text-xl font-black text-slate-800">पसंदीदा योजनाएं ({bookmarks.length})</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {masterSchemes.filter(s => bookmarks.includes(s.yojana_name)).map((s, idx) => (
                <SchemeCard key={idx} scheme={s} isBookmarked={true} onToggle={() => handleBookmark(s.yojana_name)} />
              ))}
            </div>
          </div>
        )}

        {activeTab === 'admin' && (
          <div className="max-w-2xl mx-auto space-y-8">
             {!auth.isAuthenticated ? (
               <div className="bg-white p-10 rounded-[2.5rem] shadow-xl border border-slate-50 text-center space-y-8">
                  <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto text-2xl">🔑</div>
                  <h2 className="text-xl font-black text-slate-800">Admin Control</h2>
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    if(loginForm.email === 'yadavnagji@gmail.com' && loginForm.password === '123456') {
                      setAuth({ isAuthenticated: true, user: 'Nagji Yadav' });
                    } else { alert("Galat details!"); }
                  }} className="space-y-4">
                    <input type="email" required value={loginForm.email} onChange={e => setLoginForm({...loginForm, email: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl border-0 font-bold text-xs" placeholder="Email (yadavnagji@gmail.com)" />
                    <input type="password" required value={loginForm.password} onChange={e => setLoginForm({...loginForm, password: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl border-0 font-bold text-xs" placeholder="Password (123456)" />
                    <button type="submit" className="w-full py-4 bg-orange-600 text-white font-black rounded-2xl shadow-lg">Login</button>
                  </form>
               </div>
             ) : (
               <div className="bg-white p-10 rounded-[2.5rem] shadow-xl border border-slate-50 space-y-8 animate-slide-up">
                  <div className="flex items-center justify-between border-b pb-6">
                     <h2 className="text-xl font-black text-slate-800">Config Settings</h2>
                     <button onClick={() => setAuth({isAuthenticated: false, user: null})} className="text-[10px] font-black text-slate-400 uppercase">Logout</button>
                  </div>
                  <div className="space-y-6">
                     <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase">Gemini API Key (Persistent)</label>
                        <input type="password" value={apiKeys.gemini} onChange={e => setApiKeys({...apiKeys, gemini: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl border-0 font-mono text-xs" placeholder="AI Key Enter Karein..." />
                     </div>
                     <button onClick={saveConfig} className="w-full py-4 bg-slate-900 text-white font-black rounded-2xl text-[10px] uppercase tracking-widest shadow-xl">Save API Key to Browser Database</button>
                     
                     <div className="pt-6 border-t">
                        <h3 className="text-xs font-black text-slate-800 uppercase mb-4">Database Tools</h3>
                        <div className="grid grid-cols-2 gap-4">
                           <button onClick={() => fetchMasterSchemes('Rajasthan')} className="py-4 bg-blue-50 text-blue-600 font-black rounded-2xl text-[10px] uppercase">Update Rajasthan List</button>
                           <button onClick={() => fetchMasterSchemes('Central')} className="py-4 bg-purple-50 text-purple-600 font-black rounded-2xl text-[10px] uppercase">Update Central List</button>
                        </div>
                     </div>
                  </div>
               </div>
             )}
          </div>
        )}
      </main>

      <footer className="py-20 text-center opacity-30">
        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">Sarkari Yojana AI Ecosystem Pro v4.0</p>
      </footer>
    </div>
  );
};

export default App;
