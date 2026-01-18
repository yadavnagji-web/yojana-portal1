
import React, { useState, useRef, useEffect, useMemo } from 'react';
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
            <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase bg-slate-100 text-slate-500`}>{scheme.scheme_status || 'ACTIVE'}</span>
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
              <a href={scheme.online_apply_link} target="_blank" rel="noreferrer" className="flex-1 bg-orange-600 text-white py-2.5 rounded-xl text-[10px] font-black text-center shadow-lg hover:bg-orange-700 transition-transform active:scale-95">Apply Online</a>
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
  }, [profile.district, profile.state]);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await analyzeEligibility(profile);
      setResult(res);
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (err: any) {
      alert(err.message);
      if (err.message.toLowerCase().includes("key") || err.message.toLowerCase().includes("limit")) {
        setActiveTab('admin');
      }
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

  // Performance optimization: prevent re-rendering card list unnecessarily
  const renderedSchemes = useMemo(() => {
    if (!result) return null;
    return result.eligible_schemes.map((s, idx) => (
      <SchemeCard 
        key={`${s.yojana_name}-${idx}`} 
        scheme={s} 
        isBookmarked={bookmarks.includes(s.yojana_name)} 
        onToggle={() => handleBookmark(s.yojana_name)} 
      />
    ));
  }, [result, bookmarks]);

  return (
    <div className="min-h-screen bg-[#FDFDFD] font-sans selection:bg-orange-100">
      <header className="bg-white/90 backdrop-blur-md border-b border-slate-100 sticky top-0 z-50 py-3 px-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-orange-600 rounded-xl flex items-center justify-center text-xl shadow-lg ring-4 ring-orange-50">🇮🇳</div>
             <div>
               <h1 className="text-lg font-black text-slate-800 leading-none">Sarkari Yojana AI</h1>
               <p className="text-[10px] font-black text-orange-600 uppercase tracking-widest mt-1">Smart Analytics Engine</p>
             </div>
          </div>
          <nav className="flex bg-slate-100 p-1 rounded-2xl gap-1">
            {['check', 'browse', 'saved', 'admin'].map(id => (
              <button 
                key={id} onClick={() => setActiveTab(id as any)}
                className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase transition-all duration-200 ${activeTab === id ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
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
               <form onSubmit={handleAnalyze} className="bg-white p-8 rounded-[2.5rem] shadow-2xl shadow-orange-100/20 border border-slate-50 space-y-8 animate-slide-up">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    <FormSection title="प्रोफाइल" icon="👤">
                      <div className="grid grid-cols-2 gap-4">
                        <label className="block">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">लिंग</span>
                          <select value={profile.gender} onChange={e => setProfile({...profile, gender: e.target.value})} className="w-full mt-1 p-3 bg-slate-50 border-0 rounded-xl font-bold text-xs ring-1 ring-slate-100 focus:ring-2 focus:ring-orange-500 transition-all">
                            {GENDER.map(g => <option key={g} value={g}>{g}</option>)}
                          </select>
                        </label>
                        <label className="block">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">आयु</span>
                          <input type="number" value={profile.age} onChange={e => setProfile({...profile, age: e.target.value})} className="w-full mt-1 p-3 bg-slate-50 border-0 rounded-xl font-bold text-xs ring-1 ring-slate-100 focus:ring-2 focus:ring-orange-500 transition-all" />
                        </label>
                      </div>
                      <label className="block">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">लाभार्थी प्रकार</span>
                        <select value={profile.beneficiary_type} onChange={e => setProfile({...profile, beneficiary_type: e.target.value})} className="w-full mt-1 p-3 bg-slate-50 border-0 rounded-xl font-bold text-xs ring-1 ring-slate-100">
                          {BENEFICIARY_TYPES.map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                      </label>
                      <label className="block">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">शिक्षा का स्तर</span>
                        <select value={profile.education} onChange={e => setProfile({...profile, education: e.target.value})} className="w-full mt-1 p-3 bg-slate-50 border-0 rounded-xl font-bold text-xs ring-1 ring-slate-100">
                          {EDUCATION_LEVELS.map(ed => <option key={ed} value={ed}>{ed}</option>)}
                        </select>
                      </label>
                    </FormSection>

                    <FormSection title="स्थान" icon="📍">
                      <label className="block">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">जिला (District)</span>
                        <select value={profile.district} onChange={e => setProfile({...profile, district: e.target.value})} className="w-full mt-1 p-3 bg-slate-50 border-0 rounded-xl font-bold text-xs ring-1 ring-slate-100">
                          {RAJASTHAN_DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </label>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-slate-100 rounded-xl text-[10px] font-black text-orange-600 text-center flex items-center justify-center border border-slate-200">TSP: {profile.is_tsp_area}</div>
                        <select value={profile.jan_aadhar_status} onChange={e => setProfile({...profile, jan_aadhar_status: e.target.value})} className="w-full p-3 bg-slate-50 border-0 rounded-xl font-bold text-xs ring-1 ring-slate-100">
                          <option value="Yes">JanAadhar: Yes</option>
                          <option value="No">JanAadhar: No</option>
                        </select>
                      </div>
                    </FormSection>

                    <FormSection title="परिवार एवं आय" icon="💰">
                       <div className="grid grid-cols-2 gap-4">
                          <label className="block">
                            <span className="text-[9px] font-black text-slate-400 uppercase">बच्चे (Pre-2002)</span>
                            <input type="number" value={profile.children_before_2002} onChange={e => setProfile({...profile, children_before_2002: e.target.value})} className="w-full mt-1 p-3 bg-slate-50 border-0 rounded-xl font-bold text-xs ring-1 ring-slate-100" />
                          </label>
                          <label className="block">
                            <span className="text-[9px] font-black text-slate-400 uppercase">बच्चे (Post-2002)</span>
                            <input type="number" value={profile.children_after_2002} onChange={e => setProfile({...profile, children_after_2002: e.target.value})} className="w-full mt-1 p-3 bg-slate-50 border-0 rounded-xl font-bold text-xs ring-1 ring-slate-100" />
                          </label>
                       </div>
                       <label className="block">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">वार्षिक आय (Annual Income)</span>
                          <input type="number" value={profile.income} onChange={e => setProfile({...profile, income: e.target.value})} className="w-full mt-1 p-3 bg-slate-50 border-0 rounded-xl font-bold text-xs ring-1 ring-slate-100" />
                       </label>
                    </FormSection>
                  </div>
                  <button type="submit" className="w-full py-5 bg-orange-600 text-white font-black rounded-3xl shadow-xl shadow-orange-600/20 uppercase tracking-[0.2em] text-sm transition-all active:scale-95 hover:bg-orange-700">
                    पात्र योजनाएं खोजें 🔍
                  </button>
               </form>
             )}

             {loading && (
               <div className="py-20 text-center space-y-6">
                  <div className="w-16 h-16 border-4 border-orange-100 border-t-orange-600 rounded-full animate-spin mx-auto shadow-inner"></div>
                  <div className="space-y-2">
                    <p className="font-black text-slate-800 uppercase text-xs tracking-widest">Analysis In Progress</p>
                    <p className="text-[10px] text-slate-400 font-bold">Fast-fetching latest government data...</p>
                  </div>
               </div>
             )}

             {result && !loading && (
               <div ref={resultRef} className="space-y-8 animate-slide-up">
                 <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100">
                   <div className="flex items-center justify-between mb-8">
                     <div>
                       <h2 className="text-xl font-black text-slate-800">पात्र योजनाएं ({result.eligible_schemes.length})</h2>
                       <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">AI Match Summary</p>
                     </div>
                     <button onClick={() => setResult(null)} className="text-[10px] font-black text-orange-600 bg-orange-50 px-5 py-2.5 rounded-2xl transition-all hover:bg-orange-100 active:scale-95">नया सर्च 🔄</button>
                   </div>
                   <div className="bg-slate-50 p-6 rounded-3xl mb-8 text-sm text-slate-700 leading-relaxed font-medium border border-slate-100 shadow-inner">
                      {result.hindiContent}
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {renderedSchemes}
                   </div>
                 </div>
               </div>
             )}
          </div>
        )}

        {activeTab === 'admin' && (
          <div className="max-w-2xl mx-auto space-y-8">
             {!auth.isAuthenticated ? (
               <div className="bg-white p-12 rounded-[3rem] shadow-2xl border border-slate-50 text-center space-y-8">
                  <div className="w-20 h-20 bg-orange-50 rounded-3xl flex items-center justify-center mx-auto text-3xl shadow-inner">🔒</div>
                  <div>
                    <h2 className="text-2xl font-black text-slate-800">Admin Login</h2>
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-2">Protected System Access</p>
                  </div>
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    if(loginForm.email === 'yadavnagji@gmail.com' && loginForm.password === '123456') {
                      setAuth({ isAuthenticated: true, user: 'Nagji Yadav' });
                    } else { alert("Login failed! Invalid credentials."); }
                  }} className="space-y-4">
                    <input type="email" required value={loginForm.email} onChange={e => setLoginForm({...loginForm, email: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl border-0 font-bold text-xs ring-1 ring-slate-100 focus:ring-2 focus:ring-orange-500 transition-all" placeholder="Email" />
                    <input type="password" required value={loginForm.password} onChange={e => setLoginForm({...loginForm, password: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl border-0 font-bold text-xs ring-1 ring-slate-100 focus:ring-2 focus:ring-orange-500 transition-all" placeholder="Password" />
                    <button type="submit" className="w-full py-4 bg-orange-600 text-white font-black rounded-2xl shadow-xl shadow-orange-600/20 active:scale-95 transition-all">Access Dashboard</button>
                  </form>
               </div>
             ) : (
               <div className="bg-white p-10 rounded-[3rem] shadow-2xl border border-slate-50 space-y-10 animate-slide-up">
                  <div className="flex items-center justify-between border-b border-slate-50 pb-6">
                     <div>
                       <h2 className="text-xl font-black text-slate-800">API Settings</h2>
                       <p className="text-[10px] text-orange-600 font-black uppercase tracking-widest mt-1">System Configuration</p>
                     </div>
                     <button onClick={() => setAuth({isAuthenticated: false, user: null})} className="text-[10px] font-black text-slate-400 uppercase px-4 py-2 rounded-xl bg-slate-50 hover:bg-slate-100">Logout</button>
                  </div>
                  <div className="space-y-8">
                     <div className="space-y-4">
                        <label className="block">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Gemini API Key (Box 1)</span>
                          <input type="password" value={apiKeys.gemini} onChange={e => setApiKeys({...apiKeys, gemini: e.target.value})} className="w-full mt-2 p-4 bg-slate-50 rounded-2xl border-0 font-mono text-xs ring-1 ring-slate-100" placeholder="Paste Gemini Key here" />
                        </label>
                        <label className="block">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Groq API Key (Box 2)</span>
                          <input type="password" value={apiKeys.groq} onChange={e => setApiKeys({...apiKeys, groq: e.target.value})} className="w-full mt-2 p-4 bg-slate-50 rounded-2xl border-0 font-mono text-xs ring-1 ring-slate-100" placeholder="Paste Groq Key here (gsk_...)" />
                          <p className="text-[9px] text-slate-400 font-bold mt-2">Note: Box 1 prioritize kiya jayega. Dono keys database mein permanent save rahengi.</p>
                        </label>
                     </div>
                     <button onClick={saveConfig} className="w-full py-5 bg-slate-900 text-white font-black rounded-2xl text-[11px] uppercase tracking-[0.3em] shadow-2xl relative overflow-hidden transition-all active:scale-95">
                       Lock Keys in Database
                       {showSavedMsg && (
                         <div className="absolute inset-0 bg-green-600 flex items-center justify-center animate-in fade-in zoom-in duration-300">
                           SAVED (सुरक्षित हो गया) ✅
                         </div>
                       )}
                     </button>
                     <div className="pt-6 border-t border-slate-50 space-y-4">
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Data Maintenance</h3>
                        <button onClick={() => fetchMasterSchemes('Rajasthan').then(() => alert("Master List Updated!"))} className="w-full py-4 bg-blue-50 text-blue-600 font-black rounded-2xl text-[10px] uppercase tracking-widest hover:bg-blue-100 transition-all">Force Refresh Rajasthan List 🔄</button>
                     </div>
                  </div>
               </div>
             )}
          </div>
        )}
      </main>
      
      <footer className="py-12 text-center">
        <p className="text-[9px] font-black text-slate-300 uppercase tracking-[0.5em]">Sarkari Yojana AI • Smart Welfare Analysis v4.5</p>
      </footer>
    </div>
  );
};

export default App;
