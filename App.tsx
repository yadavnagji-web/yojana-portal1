
import React, { useState, useRef, useEffect } from 'react';
import { UserProfile, AnalysisResponse, Scheme, AuthState } from './types';
import { 
  RAJASTHAN_DISTRICTS, 
  TSP_DISTRICTS, 
  CATEGORIES, 
  BENEFICIARY_TYPES, 
  GENDER, 
  MARITAL_STATUS, 
  YES_NO, 
  RATION_CARD_TYPES, 
  PENSION_TYPES, 
  PARENT_STATUS,
  EDUCATION_LEVELS
} from './constants';
import FormSection from './components/FormSection';
import { analyzeEligibility, fetchMasterSchemes } from './services/geminiService';
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
                  {(scheme.required_documents || []).map((d, i) => <li key={i}>{d}</li>)}
                </ul>
              </div>
              <div>
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">पात्रता</h4>
                <ul className="text-[10px] text-slate-600 list-disc pl-4 font-bold">
                  {(scheme.eligibility || []).map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <a href={scheme.online_apply_link} target="_blank" rel="noreferrer" className="flex-1 bg-orange-600 text-white py-2.5 rounded-xl text-[10px] font-black text-center shadow-lg hover:bg-orange-700">Apply Online</a>
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
  const [showSavedMsg, setShowSavedMsg] = useState(false);

  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const init = async () => {
      await dbService.init();
      const keys = await dbService.getSetting<any>('api_keys');
      if (keys) setApiKeys(k => ({ ...k, ...keys }));
      
      const p = await dbService.getAppData<UserProfile>('profile');
      if (p) setProfile(p);

      const r = await dbService.getAppData<AnalysisResponse>('last_result');
      if (r) setResult(r);
      
      const schemes = await dbService.getAllSchemes();
      setMasterSchemes(schemes);

      const marks = localStorage.getItem('scheme_bookmarks');
      if (marks) setBookmarks(JSON.parse(marks));
    };
    init();
  }, []);

  useEffect(() => {
    if (profile.state === 'Rajasthan' && TSP_DISTRICTS.includes(profile.district)) {
      if (profile.is_tsp_area !== 'Yes') setProfile(p => ({ ...p, is_tsp_area: 'Yes' }));
    } else if (profile.state === 'Rajasthan') {
      if (profile.is_tsp_area !== 'No') setProfile(p => ({ ...p, is_tsp_area: 'No' }));
    }
    dbService.saveAppData('profile', profile);
  }, [profile]);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await analyzeEligibility(profile);
      setResult(res);
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (err: any) {
      alert(err.message);
      if (err.message.includes("API Key") || err.message.includes("Limit")) setActiveTab('admin');
    }
    setLoading(false);
  };

  const saveConfig = async () => {
    await dbService.setSetting('api_keys', apiKeys);
    setShowSavedMsg(true);
    setTimeout(() => setShowSavedMsg(false), 3000);
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
               <p className="text-[10px] font-black text-orange-600 uppercase tracking-widest mt-1">Smart Analytics</p>
             </div>
          </div>
          <nav className="flex bg-slate-100 p-1 rounded-2xl gap-1">
            {['check', 'browse', 'saved', 'admin'].map(id => (
              <button 
                key={id} onClick={() => setActiveTab(id as any)}
                className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase transition-all ${activeTab === id ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              >
                {id === 'check' ? 'पात्रता' : id === 'browse' ? 'योजनाएं' : id === 'saved' ? 'पसंदीदा' : 'Admin'}
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
                    <FormSection title="प्रोफाइल" icon="👤">
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
                        <span className="text-[10px] font-black text-slate-400 uppercase">लाभार्थी प्रकार</span>
                        <select value={profile.beneficiary_type} onChange={e => setProfile({...profile, beneficiary_type: e.target.value})} className="w-full mt-1 p-3 bg-slate-50 border-0 rounded-xl font-bold text-xs">
                          {BENEFICIARY_TYPES.map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                      </label>
                      <label className="block">
                        <span className="text-[10px] font-black text-slate-400 uppercase">शिक्षा का स्तर</span>
                        <select value={profile.education} onChange={e => setProfile({...profile, education: e.target.value})} className="w-full mt-1 p-3 bg-slate-50 border-0 rounded-xl font-bold text-xs">
                          {EDUCATION_LEVELS.map(ed => <option key={ed} value={ed}>{ed}</option>)}
                        </select>
                      </label>
                    </FormSection>

                    <FormSection title="स्थान" icon="📍">
                      <select value={profile.district} onChange={e => setProfile({...profile, district: e.target.value})} className="w-full p-3 bg-slate-50 border-0 rounded-xl font-bold text-xs">
                        {RAJASTHAN_DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-slate-100 rounded-xl text-[10px] font-black text-orange-600 text-center">TSP: {profile.is_tsp_area}</div>
                        <select value={profile.jan_aadhar_status} onChange={e => setProfile({...profile, jan_aadhar_status: e.target.value})} className="w-full p-3 bg-slate-50 border-0 rounded-xl font-bold text-xs">
                          <option value="Yes">JanAadhar: Yes</option>
                          <option value="No">JanAadhar: No</option>
                        </select>
                      </div>
                    </FormSection>

                    <FormSection title="परिवार" icon="💰">
                       <div className="grid grid-cols-2 gap-4">
                          <input type="number" placeholder="बच्चे (Pre-2002)" value={profile.children_before_2002} onChange={e => setProfile({...profile, children_before_2002: e.target.value})} className="w-full p-3 bg-slate-50 border-0 rounded-xl font-bold text-xs" />
                          <input type="number" placeholder="बच्चे (Post-2002)" value={profile.children_after_2002} onChange={e => setProfile({...profile, children_after_2002: e.target.value})} className="w-full p-3 bg-slate-50 border-0 rounded-xl font-bold text-xs" />
                       </div>
                       <input type="number" placeholder="वार्षिक आय" value={profile.income} onChange={e => setProfile({...profile, income: e.target.value})} className="w-full p-3 bg-slate-50 border-0 rounded-xl font-bold text-xs" />
                    </FormSection>
                  </div>
                  <button type="submit" className="w-full py-5 bg-orange-600 text-white font-black rounded-3xl shadow-lg uppercase tracking-widest text-sm transition-transform active:scale-95">
                    पात्र योजनाएं खोजें 🔍
                  </button>
               </form>
             )}

             {loading && (
               <div className="py-20 text-center space-y-4">
                  <div className="w-12 h-12 border-4 border-orange-100 border-t-orange-600 rounded-full animate-spin mx-auto"></div>
                  <p className="font-black text-slate-400 uppercase text-[10px] tracking-widest">Fast data fetch in progress...</p>
               </div>
             )}

             {result && !loading && (
               <div ref={resultRef} className="space-y-8 animate-slide-up">
                 <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-slate-100">
                   <div className="flex items-center justify-between mb-8">
                     <h2 className="text-xl font-black text-slate-800">पात्र योजनाएं ({result.eligible_schemes.length})</h2>
                     <button onClick={() => setResult(null)} className="text-[10px] font-black text-orange-600 bg-orange-50 px-4 py-2 rounded-xl">नया सर्च</button>
                   </div>
                   <div className="bg-slate-50 p-6 rounded-2xl mb-8 text-sm text-slate-700 leading-relaxed font-medium">
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

        {activeTab === 'admin' && (
          <div className="max-w-2xl mx-auto space-y-8">
             {!auth.isAuthenticated ? (
               <div className="bg-white p-10 rounded-[2.5rem] shadow-xl border border-slate-50 text-center space-y-8">
                  <h2 className="text-xl font-black text-slate-800">Admin Login</h2>
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    if(loginForm.email === 'yadavnagji@gmail.com' && loginForm.password === '123456') {
                      setAuth({ isAuthenticated: true, user: 'Nagji Yadav' });
                    } else { alert("Login failed!"); }
                  }} className="space-y-4">
                    <input type="email" required value={loginForm.email} onChange={e => setLoginForm({...loginForm, email: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl border-0 font-bold text-xs" placeholder="Email" />
                    <input type="password" required value={loginForm.password} onChange={e => setLoginForm({...loginForm, password: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl border-0 font-bold text-xs" placeholder="Password" />
                    <button type="submit" className="w-full py-4 bg-orange-600 text-white font-black rounded-2xl shadow-lg">Login</button>
                  </form>
               </div>
             ) : (
               <div className="bg-white p-10 rounded-[2.5rem] shadow-xl border border-slate-50 space-y-8 animate-slide-up">
                  <div className="flex items-center justify-between border-b pb-6">
                     <h2 className="text-xl font-black text-slate-800">API Settings</h2>
                     <button onClick={() => setAuth({isAuthenticated: false, user: null})} className="text-[10px] font-black text-slate-400 uppercase">Logout</button>
                  </div>
                  <div className="space-y-6">
                     <input type="password" value={apiKeys.gemini} onChange={e => setApiKeys({...apiKeys, gemini: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl border-0 font-mono text-xs" placeholder="Gemini API Key (Box 1)" />
                     <input type="password" value={apiKeys.groq} onChange={e => setApiKeys({...apiKeys, groq: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl border-0 font-mono text-xs" placeholder="Groq API Key (Box 2)" />
                     <button onClick={saveConfig} className="w-full py-4 bg-slate-900 text-white font-black rounded-2xl text-[10px] uppercase tracking-widest shadow-xl relative overflow-hidden">
                       Save API Keys
                       {showSavedMsg && (
                         <span className="absolute inset-0 bg-green-600 flex items-center justify-center animate-in fade-in zoom-in duration-300">
                           SAVED (सुरक्षित हो गया) ✅
                         </span>
                       )}
                     </button>
                     <button onClick={() => fetchMasterSchemes('Rajasthan')} className="w-full py-3 bg-blue-50 text-blue-600 font-black rounded-xl text-[10px] uppercase">Master List Update</button>
                  </div>
               </div>
             )}
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
