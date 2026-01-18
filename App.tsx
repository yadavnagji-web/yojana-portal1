
import React, { useState, useRef, useEffect } from 'react';
import { UserProfile, AnalysisResponse, Scheme, AuthState, AIAgentLog } from './types';
import { RAJASTHAN_DISTRICTS, CATEGORIES, BENEFICIARY_TYPES, GENDER, MARITAL_STATUS, AREA_TYPE, YES_NO } from './constants';
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
              <h4 className="text-[10px] font-black text-orange-600 uppercase tracking-widest mb-2">विस्तृत लाभ (Benefits)</h4>
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
            <div>
              <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-2">आवेदन प्रक्रिया</h4>
              <ol className="text-[10px] text-slate-600 space-y-1 font-bold">
                {scheme.application_process_steps.map((s, i) => <li key={i}>{i+1}. {s}</li>)}
              </ol>
            </div>
            <div className="flex gap-2 pt-2">
              <a href={scheme.online_apply_link} target="_blank" rel="noreferrer" className="flex-1 bg-orange-600 text-white py-2.5 rounded-xl text-[10px] font-black text-center shadow-lg hover:bg-orange-700">Online Apply</a>
              {scheme.official_pdf_link && <a href={scheme.official_pdf_link} target="_blank" rel="noreferrer" className="flex-1 bg-slate-100 text-slate-600 py-2.5 rounded-xl text-[10px] font-black text-center hover:bg-slate-200">Official PDF</a>}
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
    gender: 'Female', age: '30', marital_status: 'Widowed', state: 'Rajasthan', district: 'Udaipur', rural_or_urban: 'Tribal', is_tsp_area: 'Yes',
    category: 'ST', beneficiary_type: 'Widow', minority: 'No', disability: 'No', disability_percent: '0', income: '60000', bpl: 'Yes',
    education: 'Primary', occupation: 'Laborer', labour_card: 'Yes', pregnant: 'No', lactating: 'No', family_count: '4', head_of_family: 'Yes'
  });

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [auth, setAuth] = useState<AuthState>({ isAuthenticated: false, user: null });
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [apiKeys, setApiKeys] = useState({ gemini: '', groq: '', openai: '', claude: '' });
  const [masterSchemes, setMasterSchemes] = useState<Scheme[]>([]);
  const [bookmarks, setBookmarks] = useState<string[]>([]);
  const [aiLogs, setAiLogs] = useState<AIAgentLog[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentProposal, setCurrentProposal] = useState<string | null>(null);

  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const init = async () => {
      await dbService.init();
      const savedKeys = await dbService.getSetting<typeof apiKeys>('api_keys');
      if (savedKeys) setApiKeys(savedKeys);
      const marks = localStorage.getItem('sarkari_marks');
      if (marks) setBookmarks(JSON.parse(marks));
      const logs = await dbService.getLogs();
      setAiLogs(logs.reverse());
      refreshSchemes();
    };
    init();
  }, []);

  const refreshSchemes = async () => {
    setLoading(true);
    const data = await dbService.getAllSchemes();
    setMasterSchemes(data);
    setLoading(false);
  };

  const handleBookmark = (name: string) => {
    const newMarks = bookmarks.includes(name) ? bookmarks.filter(n => n !== name) : [...bookmarks, name];
    setBookmarks(newMarks);
    localStorage.setItem('sarkari_marks', JSON.stringify(newMarks));
  };

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await analyzeEligibility(profile);
      setResult(res);
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (err: any) { alert("Analysis failed: " + err.message); }
    setLoading(false);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (loginForm.email.toLowerCase().trim() === 'yadavnagji@gmail.com' && loginForm.password === '123456') {
      setAuth({ isAuthenticated: true, user: 'Nagji Yadav' });
    } else {
      alert("Invalid Credentials. Please use yadavnagji@gmail.com / 123456");
    }
  };

  const handleAdminAction = async (agent: string, action: string) => {
    const activeKey = apiKeys.gemini || process.env.API_KEY;
    if (!activeKey) return alert("Please set Gemini API Key first.");
    
    setLoading(true);
    const logId = Math.random().toString(36).substr(2, 9);
    const log: AIAgentLog = {
      id: logId,
      timestamp: Date.now(),
      agent,
      action,
      description: `AI Agent ${agent} started: ${action}`,
      status: 'pending'
    };
    await dbService.addLog(log);
    setAiLogs(prev => [log, ...prev]);

    try {
      if (action === 'Fetch Data') {
        await fetchMasterSchemes('Rajasthan', true);
        await fetchMasterSchemes('Central', true);
      }
      if (action === 'System Improve') {
        const proposal = await proposeSystemImprovement();
        setCurrentProposal(proposal);
        log.diff = proposal;
      }
      
      log.status = 'applied';
      log.description = `AI Agent ${agent} successfully completed ${action}`;
      await dbService.addLog(log);
      await refreshSchemes();
    } catch (e: any) {
      log.status = 'rolled_back';
      log.description = `Error: ${e.message}`;
      await dbService.addLog(log);
      alert("Action failed: " + e.message);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#FDFDFD] font-sans selection:bg-orange-100">
      <header className="bg-white/80 backdrop-blur-xl border-b border-slate-100 sticky top-0 z-50 py-3 px-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-gradient-to-br from-orange-600 to-amber-500 rounded-2xl flex items-center justify-center text-xl shadow-lg shadow-orange-200">🇮🇳</div>
             <div>
               <h1 className="text-lg font-black tracking-tight text-slate-800 leading-none">Sarkari Yojana</h1>
               <p className="text-[10px] font-black text-orange-600 uppercase tracking-widest mt-1">Smart Welfare AI</p>
             </div>
          </div>
          <nav className="flex bg-slate-100 p-1 rounded-2xl gap-1">
            {[
              { id: 'check', label: 'पात्रता', icon: '🔍' },
              { id: 'browse', label: 'योजनाएं', icon: '📑' },
              { id: 'saved', label: 'पसंदीदा', icon: '💖' },
              { id: 'admin', label: 'एडमिन', icon: '⚙️' }
            ].map(tab => (
              <button 
                key={tab.id} onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all flex items-center gap-2 ${activeTab === tab.id ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              >
                <span>{tab.icon}</span> {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {activeTab === 'check' && (
          <div className="space-y-8 animate-in fade-in duration-500">
             {!result && !loading && (
               <form onSubmit={handleAnalyze} className="bg-white p-8 rounded-[2.5rem] shadow-2xl border border-slate-50 space-y-10">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                    <FormSection title="व्यक्तिगत प्रोफाइल" icon="👤">
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <label className="block space-y-1">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">लिंग</span>
                            <select value={profile.gender} onChange={e => setProfile({...profile, gender: e.target.value})} className="w-full p-3.5 bg-slate-50 border-0 rounded-2xl font-bold text-xs ring-1 ring-slate-100 focus:ring-2 focus:ring-orange-500">
                              {GENDER.map(g => <option key={g} value={g}>{g}</option>)}
                            </select>
                          </label>
                          <label className="block space-y-1">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">आयु</span>
                            <input type="number" value={profile.age} onChange={e => setProfile({...profile, age: e.target.value})} className="w-full p-3.5 bg-slate-50 border-0 rounded-2xl font-bold text-xs ring-1 ring-slate-100 focus:ring-2 focus:ring-orange-500" />
                          </label>
                        </div>
                        <label className="block space-y-1">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">शादी की स्थिति</span>
                          <select value={profile.marital_status} onChange={e => setProfile({...profile, marital_status: e.target.value})} className="w-full p-3.5 bg-slate-50 border-0 rounded-2xl font-bold text-xs ring-1 ring-slate-100 focus:ring-2 focus:ring-orange-500">
                            {MARITAL_STATUS.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </label>
                        <label className="block space-y-1">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">लाभार्थी श्रेणी</span>
                          <select value={profile.beneficiary_type} onChange={e => setProfile({...profile, beneficiary_type: e.target.value})} className="w-full p-3.5 bg-slate-50 border-0 rounded-2xl font-bold text-xs ring-1 ring-slate-100 focus:ring-2 focus:ring-orange-500">
                            {BENEFICIARY_TYPES.map(b => <option key={b} value={b}>{b}</option>)}
                          </select>
                        </label>
                      </div>
                    </FormSection>

                    <FormSection title="स्थान एवं क्षेत्र" icon="📍">
                      <div className="space-y-4">
                        <label className="block space-y-1">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">जिला (Rajasthan)</span>
                          <select value={profile.district} onChange={e => setProfile({...profile, district: e.target.value})} className="w-full p-3.5 bg-slate-50 border-0 rounded-2xl font-bold text-xs ring-1 ring-slate-100 focus:ring-2 focus:ring-orange-500">
                            {RAJASTHAN_DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
                          </select>
                        </label>
                        <label className="block space-y-1">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">क्षेत्र का प्रकार</span>
                          <select value={profile.rural_or_urban} onChange={e => setProfile({...profile, rural_or_urban: e.target.value})} className="w-full p-3.5 bg-slate-50 border-0 rounded-2xl font-bold text-xs ring-1 ring-slate-100 focus:ring-2 focus:ring-orange-500">
                            {AREA_TYPE.map(a => <option key={a} value={a}>{a}</option>)}
                          </select>
                        </label>
                        <label className="block space-y-1">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">TSP/Tribal Area</span>
                          <select value={profile.is_tsp_area} onChange={e => setProfile({...profile, is_tsp_area: e.target.value})} className="w-full p-3.5 bg-slate-50 border-0 rounded-2xl font-bold text-xs ring-1 ring-slate-100 focus:ring-2 focus:ring-orange-500">
                            {YES_NO.map(y => <option key={y} value={y}>{y}</option>)}
                          </select>
                        </label>
                      </div>
                    </FormSection>

                    <FormSection title="आर्थिक पृष्ठभूमि" icon="📊">
                      <div className="space-y-4">
                        <label className="block space-y-1">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">वर्ग (Category)</span>
                          <select value={profile.category} onChange={e => setProfile({...profile, category: e.target.value})} className="w-full p-3.5 bg-slate-50 border-0 rounded-2xl font-bold text-xs ring-1 ring-slate-100 focus:ring-2 focus:ring-orange-500">
                            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </label>
                        <label className="block space-y-1">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">वार्षिक आय</span>
                          <input type="number" value={profile.income} onChange={e => setProfile({...profile, income: e.target.value})} className="w-full p-3.5 bg-slate-50 border-0 rounded-2xl font-bold text-xs ring-1 ring-slate-100 focus:ring-2 focus:ring-orange-500" />
                        </label>
                        <div className="flex flex-col gap-2">
                          <label className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100 cursor-pointer">
                            <input type="checkbox" checked={profile.bpl === 'Yes'} onChange={e => setProfile({...profile, bpl: e.target.checked ? 'Yes' : 'No'})} className="rounded text-orange-600" />
                            <span className="text-[10px] font-black text-slate-500 uppercase">BPL कार्ड?</span>
                          </label>
                          <label className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100 cursor-pointer">
                            <input type="checkbox" checked={profile.labour_card === 'Yes'} onChange={e => setProfile({...profile, labour_card: e.target.checked ? 'Yes' : 'No'})} className="rounded text-orange-600" />
                            <span className="text-[10px] font-black text-slate-500 uppercase">श्रम कार्ड?</span>
                          </label>
                        </div>
                      </div>
                    </FormSection>
                  </div>
                  <button type="submit" disabled={loading} className="w-full py-5 bg-orange-600 text-white font-black rounded-3xl shadow-2xl hover:bg-orange-700 transition-all uppercase tracking-[0.2em] text-sm disabled:opacity-50">
                    पात्र योजनाएं खोजें 🔍
                  </button>
               </form>
             )}

             {loading && (
               <div className="py-20 text-center space-y-6">
                  <div className="w-16 h-16 border-4 border-orange-100 border-t-orange-600 rounded-full animate-spin mx-auto"></div>
                  <div className="space-y-2">
                    <p className="font-black text-slate-800 uppercase text-xs tracking-widest">AI द्वारा विश्लेषण जारी है...</p>
                    <p className="text-[10px] text-slate-400 font-bold max-w-xs mx-auto">हम सरकारी डेटाबेस और पात्रता नियमों की जांच कर रहे हैं।</p>
                  </div>
               </div>
             )}

             {result && !loading && (
               <div ref={resultRef} className="space-y-8 animate-in slide-in-from-bottom-10 duration-700">
                 <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100">
                   <div className="flex items-center justify-between mb-8">
                     <h2 className="text-2xl font-black text-slate-800">पात्र योजनाएं ({result.eligible_schemes.length})</h2>
                     <button onClick={() => setResult(null)} className="text-[10px] font-black text-orange-600 bg-orange-50 px-5 py-2.5 rounded-2xl hover:bg-orange-100 uppercase tracking-widest">🔄 नया सर्च</button>
                   </div>
                   <div className="bg-orange-50/30 p-6 rounded-[2rem] border border-orange-100 mb-10 text-slate-700 font-bold text-sm leading-relaxed whitespace-pre-wrap">
                      {result.hindiContent}
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-3xl shadow-sm border border-slate-50">
              <div className="relative flex-1 w-full">
                <input type="text" placeholder="योजना खोजें..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full p-4 bg-slate-50 border-0 rounded-2xl focus:ring-2 focus:ring-orange-500 pl-12 text-sm font-bold" />
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg">🔍</span>
              </div>
              <button onClick={refreshSchemes} className="px-6 py-4 bg-orange-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-orange-700 transition-all">Refresh List 🔄</button>
            </div>
            {loading ? (
              <div className="py-20 text-center text-slate-300 font-black">लोड हो रहा है...</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {masterSchemes.filter(s => s.yojana_name.toLowerCase().includes(searchTerm.toLowerCase())).map((s, idx) => (
                  <SchemeCard key={idx} scheme={s} isBookmarked={bookmarks.includes(s.yojana_name)} onToggle={() => handleBookmark(s.yojana_name)} />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'saved' && (
          <div className="space-y-8">
            <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3"><span>💖</span> पसंदीदा योजनाएं ({bookmarks.length})</h2>
            {bookmarks.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {masterSchemes.filter(s => bookmarks.includes(s.yojana_name)).map((s, idx) => (
                  <SchemeCard key={idx} scheme={s} isBookmarked={true} onToggle={() => handleBookmark(s.yojana_name)} />
                ))}
              </div>
            ) : (
              <div className="py-32 text-center border-4 border-dashed border-slate-100 rounded-[3rem] space-y-4">
                <p className="text-slate-400 font-black text-lg">कोई पसंदीदा योजना नहीं है।</p>
                <button onClick={() => setActiveTab('browse')} className="text-orange-600 font-black text-xs uppercase tracking-widest underline">योजनाएं खोजें</button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'admin' && (
          <div className="max-w-4xl mx-auto space-y-8">
             {!auth.isAuthenticated ? (
               <div className="bg-white p-12 rounded-[3rem] shadow-2xl border border-slate-50 text-center space-y-10 animate-in zoom-in-95">
                  <div className="w-20 h-20 bg-orange-100 rounded-[2rem] flex items-center justify-center mx-auto text-4xl shadow-inner">🔑</div>
                  <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Admin Control</h2>
                  <form onSubmit={handleLogin} className="space-y-4 max-w-sm mx-auto">
                    <input type="email" required value={loginForm.email} onChange={e => setLoginForm({...loginForm, email: e.target.value})} className="w-full p-4.5 bg-slate-50 rounded-2xl border border-slate-100 font-bold text-xs" placeholder="UserID (yadavnagji@gmail.com)" />
                    <input type="password" required value={loginForm.password} onChange={e => setLoginForm({...loginForm, password: e.target.value})} className="w-full p-4.5 bg-slate-50 rounded-2xl border border-slate-100 font-bold text-xs" placeholder="Password (123456)" />
                    <button type="submit" className="w-full py-4.5 bg-orange-600 text-white font-black rounded-2xl shadow-xl hover:bg-orange-700 transition-all uppercase tracking-widest">Login</button>
                  </form>
               </div>
             ) : (
               <div className="space-y-8 animate-in slide-in-from-bottom-5">
                  <div className="bg-white p-6 rounded-[2rem] shadow-xl flex items-center justify-between border border-slate-100">
                     <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-green-100 text-green-600 rounded-xl flex items-center justify-center font-black">AI</div>
                        <div>
                           <h2 className="text-xl font-black text-slate-800">Smart AI Admin Panel</h2>
                           <p className="text-[10px] font-black text-green-600 uppercase tracking-widest">Logged in as: {auth.user}</p>
                        </div>
                     </div>
                     <button onClick={() => setAuth({isAuthenticated: false, user: null})} className="px-5 py-2.5 bg-slate-100 text-slate-500 font-black rounded-2xl hover:bg-red-50 hover:text-red-600 text-[10px] uppercase tracking-widest">Logout</button>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {[
                      { label: 'Data Extraction', agent: 'Agent 1', action: 'Fetch Data', color: 'bg-blue-600' },
                      { label: 'Link Eligibility', agent: 'Agent 2', action: 'Map Logic', color: 'bg-purple-600' },
                      { label: 'Detect Changes', agent: 'Agent 3', action: 'Hash Compare', color: 'bg-emerald-600' },
                      { label: 'Simplify Lang', agent: 'Agent 4', action: 'Transliterate', color: 'bg-amber-600' },
                      { label: 'System Improve', agent: 'Agent 5', action: 'System Improve', color: 'bg-rose-600' }
                    ].map(btn => (
                      <button 
                        key={btn.label} 
                        disabled={loading}
                        onClick={() => handleAdminAction(btn.agent, btn.action)} 
                        className={`${btn.color} text-white p-4 rounded-3xl shadow-lg hover:scale-105 active:scale-95 transition-all text-center space-y-1 disabled:opacity-50`}
                      >
                        <div className="text-[9px] font-black uppercase opacity-60">{btn.agent}</div>
                        <div className="text-[11px] font-black leading-tight">{btn.label}</div>
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                     <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100 space-y-6">
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Configuration (Database)</h3>
                        <div className="space-y-4">
                           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                             <div className="space-y-1">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Gemini API Key</label>
                                <input type="password" value={apiKeys.gemini} onChange={e => setApiKeys({...apiKeys, gemini: e.target.value})} className="w-full p-3 bg-slate-50 rounded-xl border border-slate-100 font-mono text-[10px] focus:ring-2 focus:ring-orange-500" placeholder="Jemini Key" />
                             </div>
                             <div className="space-y-1">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">OpenAI API Key</label>
                                <input type="password" value={apiKeys.openai} onChange={e => setApiKeys({...apiKeys, openai: e.target.value})} className="w-full p-3 bg-slate-50 rounded-xl border border-slate-100 font-mono text-[10px] focus:ring-2 focus:ring-orange-500" placeholder="OpenAI Key" />
                             </div>
                             <div className="space-y-1">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Groq API Key</label>
                                <input type="password" value={apiKeys.groq} onChange={e => setApiKeys({...apiKeys, groq: e.target.value})} className="w-full p-3 bg-slate-50 rounded-xl border border-slate-100 font-mono text-[10px] focus:ring-2 focus:ring-orange-500" placeholder="Groq Key" />
                             </div>
                             <div className="space-y-1">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Claude API Key</label>
                                <input type="password" value={apiKeys.claude} onChange={e => setApiKeys({...apiKeys, claude: e.target.value})} className="w-full p-3 bg-slate-50 rounded-xl border border-slate-100 font-mono text-[10px] focus:ring-2 focus:ring-orange-500" placeholder="Claude Key" />
                             </div>
                           </div>
                           <button 
                             onClick={async () => {
                               await dbService.setSetting('api_keys', apiKeys);
                               alert("Config saved successfully to IndexedDB.");
                             }} 
                             className="w-full py-4 bg-slate-900 text-white font-black rounded-2xl text-[10px] uppercase tracking-widest shadow-xl hover:bg-black"
                           >
                             Save Permanent Config
                           </button>
                        </div>
                     </div>

                     <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100 space-y-6">
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">AI Agent Logs</h3>
                        <div className="max-h-[300px] overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-orange-200">
                           {aiLogs.length > 0 ? aiLogs.map(log => (
                             <div key={log.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                                <div className="flex items-center justify-between">
                                   <div className="text-[9px] font-black text-slate-400 uppercase">{log.agent} | {new Date(log.timestamp).toLocaleTimeString()}</div>
                                   <div className={`text-[8px] font-black uppercase px-2 py-0.5 rounded ${log.status === 'applied' ? 'bg-green-100 text-green-600' : log.status === 'pending' ? 'bg-orange-100 text-orange-600' : 'bg-red-100 text-red-600'}`}>
                                     {log.status}
                                   </div>
                                </div>
                                <div className="text-xs font-bold text-slate-700 leading-tight">{log.description}</div>
                                {log.diff && (
                                  <button onClick={() => setCurrentProposal(log.diff || null)} className="text-[9px] font-black text-blue-600 underline">View System Proposal</button>
                                )}
                             </div>
                           )) : <p className="text-center py-10 text-[10px] text-slate-300 font-black">No activity logs yet.</p>}
                        </div>
                     </div>
                  </div>

                  {currentProposal && (
                    <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl border border-blue-100 animate-in slide-in-from-top-4">
                       <div className="flex items-center justify-between mb-6">
                          <h3 className="text-lg font-black text-blue-800">AI Coding Agent Proposal (Agent 5)</h3>
                          <button onClick={() => setCurrentProposal(null)} className="text-slate-400 hover:text-slate-600">✕</button>
                       </div>
                       <div className="bg-slate-900 rounded-3xl p-6 overflow-x-auto">
                          <pre className="text-blue-400 text-xs font-mono leading-relaxed whitespace-pre-wrap">{currentProposal}</pre>
                       </div>
                       <div className="flex gap-4 mt-6">
                          <button onClick={() => alert("Implementation logic would execute here in production.")} className="flex-1 py-4 bg-blue-600 text-white font-black rounded-2xl text-[10px] uppercase tracking-widest">Approve & Deploy</button>
                          <button onClick={() => setCurrentProposal(null)} className="flex-1 py-4 bg-slate-100 text-slate-400 font-black rounded-2xl text-[10px] uppercase tracking-widest">Reject Proposal</button>
                       </div>
                    </div>
                  )}
               </div>
             )}
          </div>
        )}
      </main>

      <footer className="py-20 text-center opacity-40">
        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">Sarkari Yojana AI Ecosystem Pro v3.2</p>
      </footer>
    </div>
  );
};

export default App;
