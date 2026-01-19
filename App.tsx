
import React, { useState, useEffect } from 'react';
import { UserProfile, AnalysisResponse, Scheme, EligibilityStatus } from './types';
import { 
  RAJASTHAN_DISTRICTS, CATEGORIES, GENDER, INCOME_SLABS, MARITAL_STATUS,
  YES_NO, RATION_CARD_TYPES, EMPLOYMENT_STATUS, GOVT_SERVICE, 
  RURAL_URBAN, EDUCATION_LEVELS, INSTITUTION_TYPES, PENSION_STATUS
} from './constants';
import FormSection from './components/FormSection';
import { analyzeEligibility } from './services/geminiService';
import { dbService } from './services/dbService';

const translations = {
  hi: {
    title: 'Sarkari Yojana Search Engine',
    desc: 'AI Based Analytics',
    form: 'आवेदन फॉर्म',
    features: 'विशेषताएँ',
    submit: 'खोजें (Submit)',
    searching: 'सरकारी डेटा की लाइव जांच जारी है...',
    results: 'खोज परिणाम',
    newForm: 'नया फॉर्म',
    insuranceHeader: 'बीमा एवं पेंशन योजनाएं शामिल हैं',
    langToggle: 'English',
    // Sections
    personal: 'व्यक्तिगत विवरण',
    location: 'स्थान और श्रेणी',
    economic: 'आर्थिक स्थिति',
    education: 'शिक्षा विवरण',
    health: 'स्वास्थ्य और विशेष',
    employment: 'रोजगार विवरण',
    farmer: 'किसान विवरण',
    govt: 'सरकारी नौकरी और आईडी',
    // Labels
    fullName: 'पूरा नाम',
    gender: 'लिंग',
    marital: 'वैवाहिक स्थिति',
    dob: 'जन्म तिथि',
    age: 'उम्र',
    district: 'जिला (राजस्थान)',
    area: 'क्षेत्र',
    tsp: 'TSP क्षेत्र',
    category: 'वर्ग / जाति',
    minority: 'अल्पसंख्यक',
    income: 'वार्षिक आय',
    bpl: 'BPL स्थिति',
    ration: 'राशन कार्ड',
    familyCount: 'परिवार सदस्य',
    familyHead: 'परिवार मुखिया',
    studying: 'क्या अभी पढ़ रहे हैं?',
    highEdu: 'उच्चतम शिक्षा',
    instType: 'संस्थान प्रकार',
    class: 'कक्षा / कोर्स',
    pregnant: 'गर्भवती?',
    lactating: 'धात्री माता?',
    disability: 'दिव्यांग?',
    disabilityPercent: 'दिव्यांग %',
    pension: 'पेंशन का लाभ',
    empStatus: 'रोजगार की स्थिति',
    labourCard: 'श्रमिक कार्ड',
    nregaCard: 'नरेगा कार्ड',
    isFarmer: 'क्या किसान हैं?',
    landOwner: 'भूमि मालिक',
    pmKisan: 'PM किसान',
    selfGovt: 'स्वयं कर्मचारी',
    famGovt: 'परिवार सरकारी',
    janAadhar: 'जन-आधार',
    bankDbt: 'बैंक DBT',
    phone: 'मोबाइल नंबर',
    senior: 'वरिष्ठ नागरिक?',
    destitute: 'निराश्रित/असहाय?',
    // Features page
    fTitle: 'पोर्टल की प्रमुख विशेषताएँ',
    fDesc: 'AI-संचालित तकनीक और हाइब्रित डेटाबेस खोज।',
    f1: 'हाइब्रिड खोज प्रणाली',
    f1d: 'पहले स्थानीय डेटाबेस में खोज और फिर अद्यतन जानकारी के लिए लाइव AI का उपयोग।',
    f2: 'बीमा एवं बैंक योजनाएं',
    f2d: 'अटल पेंशन, PMJJBY, PMSBY जैसी बैंक द्वारा संचालित सरकारी बीमा योजनाओं की विस्तृत जानकारी।',
    f3: 'द्विभाषी अनुवादक',
    f3d: 'एक बटन की क्लिक पर हिंदी और अंग्रेजी में पोर्टल का अनुवाद।',
    f4: 'स्मार्ट AI विश्लेषण',
    f4d: 'Gemini 3 Pro तकनीक से आपकी प्रोफाइल का गहन विश्लेषण।',
    f5: 'आवेदन रोडमैप',
    f5d: 'दस्तावेज़, हस्ताक्षर और जमा करने के स्थान की स्पष्ट जानकारी।',
    f6: 'सुरक्षित तकनीक',
    f6d: 'आपका डेटा सुरक्षित रहता है और विश्लेषण पूरी तरह से पारदर्शी है।'
  },
  en: {
    title: 'Govt Scheme Search Engine',
    desc: 'AI Based Analytics',
    form: 'Application Form',
    features: 'Features',
    submit: 'Search Now (Submit)',
    searching: 'Live Govt Data Analysis in Progress...',
    results: 'Search Results',
    newForm: 'New Form',
    insuranceHeader: 'Includes Insurance & Pension Schemes',
    langToggle: 'हिंदी',
    // Sections
    personal: 'Personal Details',
    location: 'Location & Category',
    economic: 'Economic Status',
    education: 'Education Details',
    health: 'Health & Special',
    employment: 'Employment Details',
    farmer: 'Farmer Details',
    govt: 'Govt Job & ID',
    // Labels
    fullName: 'Full Name',
    gender: 'Gender',
    marital: 'Marital Status',
    dob: 'Date of Birth',
    age: 'Age',
    district: 'District (Rajasthan)',
    area: 'Area',
    tsp: 'TSP Area',
    category: 'Category / Caste',
    minority: 'Minority',
    income: 'Annual Income',
    bpl: 'BPL Status',
    ration: 'Ration Card',
    familyCount: 'Family Members',
    familyHead: 'Family Head',
    studying: 'Currently Studying?',
    highEdu: 'Highest Education',
    instType: 'Institution Type',
    class: 'Class / Course',
    pregnant: 'Pregnant?',
    lactating: 'Lactating Mother?',
    disability: 'Disability?',
    disabilityPercent: 'Disability %',
    pension: 'Pension Benefit',
    empStatus: 'Employment Status',
    labourCard: 'Labour Card',
    nregaCard: 'NREGA Card',
    isFarmer: 'Are you a Farmer?',
    landOwner: 'Land Owner',
    pmKisan: 'PM Kisan',
    selfGovt: 'Self Govt Employee',
    famGovt: 'Family Govt Employee',
    janAadhar: 'Jan-Aadhar',
    bankDbt: 'Bank DBT',
    phone: 'Mobile Number',
    senior: 'Senior Citizen?',
    destitute: 'Destitute/Helpless?',
    // Features page
    fTitle: 'Key Portal Features',
    fDesc: 'AI-Powered Tech & Hybrid Database Search.',
    f1: 'Hybrid Search System',
    f1d: 'First searches local DB, then triggers live AI for the latest updates.',
    f2: 'Insurance & Bank Schemes',
    f2d: 'Detailed info on bank-led insurance like APY, PMJJBY, and PMSBY.',
    f3: 'Bilingual Translator',
    f3d: 'Switch portal language between Hindi and English with one click.',
    f4: 'Smart AI Analysis',
    f4d: 'Deep profile analysis using Gemini 3 Pro technology.',
    f5: 'Application Roadmap',
    f5d: 'Clear info on documents, signatures, and submission points.',
    f6: 'Secure Tech',
    f6d: 'Your data is secure and analysis is completely transparent.'
  }
};

const StatusBadge: React.FC<{ status?: EligibilityStatus }> = ({ status }) => {
  const safeStatus = status || 'CONDITIONAL';
  const config = {
    ELIGIBLE: { bg: 'bg-green-100', text: 'text-green-700', label: '✅ पात्र' },
    NOT_ELIGIBLE: { bg: 'bg-red-100', text: 'text-red-700', label: '❌ अपात्र' },
    CONDITIONAL: { bg: 'bg-blue-100', text: 'text-blue-700', label: '⚠️ दस्तावेज़ आधारित' }
  };
  const { bg, text, label } = config[safeStatus] || config['CONDITIONAL'];
  return <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase ${bg} ${text}`}>{label}</span>;
};

const SchemesTable: React.FC<{ schemes: Scheme[] }> = ({ schemes }) => {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  if (!schemes || schemes.length === 0) return (
    <div className="text-center py-20 bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-200">
      <p className="text-slate-400 font-black text-lg">कोई उपयुक्त योजना नहीं मिली।</p>
    </div>
  );

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
                <tr className={`border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer ${isExpanded ? 'bg-blue-50/40' : ''}`} onClick={() => setExpandedId(isExpanded ? null : idx)}>
                  <td className="p-5">
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-black text-slate-800">{scheme?.yojana_name || 'योजना नाम अनुपलब्ध'}</span>
                      <span className={`text-[9px] font-bold uppercase w-fit px-1.5 py-0.5 rounded ${scheme?.government?.includes('Rajasthan') ? 'bg-blue-600 text-white' : 'bg-indigo-600 text-white'}`}>
                        {scheme?.government || 'सरकारी'}
                      </span>
                    </div>
                  </td>
                  <td className="p-5"><p className="text-xs text-slate-600 font-bold line-clamp-2 max-w-xs">{scheme?.detailed_benefits || 'विवरण उपलब्ध नहीं'}</p></td>
                  <td className="p-5"><StatusBadge status={scheme?.eligibility_status} /></td>
                  <td className="p-5 text-center"><button className="px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase hover:bg-blue-600 transition-all shadow-sm">{isExpanded ? 'बंद' : 'देखें'}</button></td>
                </tr>
                {isExpanded && (
                  <tr className="bg-blue-50/20">
                    <td colSpan={4} className="p-8">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-10 animate-slide-up">
                        <div className="space-y-4">
                          <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest">आवेदन रोडमैप</h4>
                          <div className="space-y-3 bg-white p-5 rounded-2xl border border-blue-100 shadow-sm">
                            <div><p className="text-[9px] font-black text-slate-400 uppercase">हस्ताक्षर</p><p className="text-xs font-bold text-slate-800">{Array.isArray(scheme?.signatures_required) ? scheme.signatures_required.join(", ") : (scheme?.signatures_required || "स्वयं")}</p></div>
                            <div><p className="text-[9px] font-black text-slate-400 uppercase">जमा स्थान</p><p className="text-xs font-bold text-slate-800">{scheme?.submission_point || 'ई-मित्र / कार्यालय'}</p></div>
                            <div><p className="text-[9px] font-black text-slate-400 uppercase">प्रक्रिया</p><p className="text-xs font-bold text-slate-800">{scheme?.application_type || 'ऑनलाइन'}</p></div>
                          </div>
                        </div>
                        <div className="space-y-4">
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">दस्तावेज़</h4>
                          <ul className="space-y-2">{Array.isArray(scheme?.required_documents) ? scheme.required_documents.map((doc, i) => (<li key={i} className="text-[11px] font-bold text-slate-600 flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-100"><span className="w-2 h-2 bg-blue-500 rounded-full shrink-0"></span> {doc}</li>)) : <li className="text-[11px] font-bold text-slate-600">जानकारी उपलब्ध नहीं</li>}</ul>
                        </div>
                        <div className="space-y-4">
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">पात्रता तर्क</h4>
                          <div className="bg-white p-5 rounded-2xl border border-slate-100 italic text-xs text-slate-600 font-bold leading-relaxed mb-4">"{scheme?.eligibility_reason_hindi || 'आपकी प्रोफाइल इस योजना के मानदंडों को पूरा करती है।'}"</div>
                          <a href={scheme?.official_pdf_link && scheme.official_pdf_link !== "#" ? scheme.official_pdf_link : "https://www.google.com/search?q=" + encodeURIComponent(scheme?.yojana_name || '')} target="_blank" rel="noreferrer" className="block w-full py-4 bg-slate-900 text-white text-center rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-lg">आधिकारिक पोर्टल</a>
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
  const [lang, setLang] = useState<'hi' | 'en'>('hi');
  const [activeTab, setActiveTab] = useState<'form' | 'features'>('form');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const t = translations[lang];

  const [profile, setProfile] = useState<UserProfile>({
    fullName: '', phone: '', gender: 'Female', dob: '1995-01-01', age: 30, marital_status: 'Married', state: 'Rajasthan', district: 'Jaipur', rural_or_urban: 'Rural', family_count: '4', head_of_family: 'Yes', income: INCOME_SLABS[1], bpl: 'No', ration_card_type: 'APL', category: 'General', is_tsp_area: 'No', minority: 'No', is_studying: 'No', education: 'Graduate', institution_type: 'N/A', current_class: 'N/A', pregnant: 'No', lactating: 'No', disability: 'No', disability_percent: '0', employment_status: 'Unemployed', labour_card: 'No', mnega_card: 'No', is_farmer: 'No', land_owner: 'No', pm_kisan_beneficiary: 'No', pension_status: 'None', is_senior_citizen: 'No', is_destitute: 'No', is_govt_employee: 'None', family_govt_employee: 'None', jan_aadhar_status: 'Yes', bank_account_dbt: 'Yes'
  });

  useEffect(() => {
    dbService.init();
  }, []);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const res = await analyzeEligibility(profile, false);
      setResult(res);
    } catch (err: any) { 
      alert(err.message || "खोज के दौरान त्रुटि हुई। कृपया फिर से प्रयास करें।"); 
    }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#FDFDFD] flex flex-col font-sans">
      <header className="bg-white border-b sticky top-0 z-50 py-4 px-4 shadow-sm shrink-0">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3"><div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center text-xl shadow-lg ring-4 ring-blue-50">🇮🇳</div><div><h1 className="text-base font-black text-slate-800 leading-none">{t.title}</h1><p className="text-[9px] font-black text-blue-600 uppercase tracking-widest mt-1">{t.desc}</p></div></div>
          <div className="flex items-center gap-4">
            <button onClick={() => setLang(lang === 'hi' ? 'en' : 'hi')} className="px-3 py-1.5 bg-blue-50 text-blue-600 text-[10px] font-black rounded-lg hover:bg-blue-100 transition-colors uppercase">{t.langToggle}</button>
            <nav className="flex bg-slate-100 p-1 rounded-2xl gap-1">
              <button onClick={() => setActiveTab('form')} className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase transition-all ${activeTab === 'form' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>{t.form}</button>
              <button onClick={() => setActiveTab('features')} className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase transition-all ${activeTab === 'features' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>{t.features}</button>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 flex-1 w-full">
        {activeTab === 'form' && (
          <div className="space-y-8 animate-slide-up">
            {!result && !loading && (
              <form onSubmit={handleAnalyze} className="bg-white p-6 md:p-12 rounded-[3.5rem] shadow-2xl border border-slate-50 space-y-12">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-y-12 gap-x-10">
                  
                  {/* व्यक्तिगत विवरण */}
                  <FormSection title={t.personal} icon="👤">
                    <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">{t.fullName}</label><input type="text" value={profile.fullName} onChange={e => setProfile({...profile, fullName: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100" placeholder={t.fullName} required /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">{t.gender}</label><select value={profile.gender} onChange={e => setProfile({...profile, gender: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{GENDER.map(g => <option key={g}>{g}</option>)}</select></div>
                      <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">{t.marital}</label><select value={profile.marital_status} onChange={e => setProfile({...profile, marital_status: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{MARITAL_STATUS.map(m => <option key={m}>{m}</option>)}</select></div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">{t.dob}</label><input type="date" value={profile.dob} onChange={e => setProfile({...profile, dob: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100" /></div>
                      <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">{t.age}</label><input type="number" value={profile.age} onChange={e => setProfile({...profile, age: parseInt(e.target.value)})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100" placeholder={t.age} /></div>
                    </div>
                  </FormSection>

                  {/* स्थान और श्रेणी */}
                  <FormSection title={t.location} icon="📍">
                    <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">{t.district}</label><select value={profile.district} onChange={e => setProfile({...profile, district: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{RAJASTHAN_DISTRICTS.map(d => <option key={d}>{d}</option>)}</select></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">{t.area}</label><select value={profile.rural_or_urban} onChange={e => setProfile({...profile, rural_or_urban: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{RURAL_URBAN.map(r => <option key={r}>{r}</option>)}</select></div>
                      <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">{t.tsp}</label><select value={profile.is_tsp_area} onChange={e => setProfile({...profile, is_tsp_area: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{YES_NO.map(y => <option key={y}>{y}</option>)}</select></div>
                    </div>
                    <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">{t.category}</label><select value={profile.category} onChange={e => setProfile({...profile, category: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div>
                    <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">{t.minority}</label><select value={profile.minority} onChange={e => setProfile({...profile, minority: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{YES_NO.map(y => <option key={y}>{y}</option>)}</select></div>
                  </FormSection>

                  {/* आर्थिक स्थिति */}
                  <FormSection title={t.economic} icon="💰">
                    <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">{t.income}</label><select value={profile.income} onChange={e => setProfile({...profile, income: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{INCOME_SLABS.map(s => <option key={s}>{s}</option>)}</select></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">{t.bpl}</label><select value={profile.bpl} onChange={e => setProfile({...profile, bpl: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{YES_NO.map(y => <option key={y}>{y}</option>)}</select></div>
                      <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">{t.ration}</label><select value={profile.ration_card_type} onChange={e => setProfile({...profile, ration_card_type: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{RATION_CARD_TYPES.map(r => <option key={r}>{r}</option>)}</select></div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">{t.familyCount}</label><input type="number" value={profile.family_count} onChange={e => setProfile({...profile, family_count: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100" placeholder={t.familyCount} /></div>
                      <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">{t.familyHead}</label><select value={profile.head_of_family} onChange={e => setProfile({...profile, head_of_family: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{YES_NO.map(y => <option key={y}>{y}</option>)}</select></div>
                    </div>
                  </FormSection>

                  {/* शिक्षा विवरण */}
                  <FormSection title={t.education} icon="🎓">
                    <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">{t.studying}</label><select value={profile.is_studying} onChange={e => setProfile({...profile, is_studying: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{YES_NO.map(y => <option key={y}>{y}</option>)}</select></div>
                    <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">{t.highEdu}</label><select value={profile.education} onChange={e => setProfile({...profile, education: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{EDUCATION_LEVELS.map(e => <option key={e}>{e}</option>)}</select></div>
                    <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">{t.instType}</label><select value={profile.institution_type} onChange={e => setProfile({...profile, institution_type: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{INSTITUTION_TYPES.map(i => <option key={i}>{i}</option>)}</select></div>
                    <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">{t.class}</label><input type="text" value={profile.current_class} onChange={e => setProfile({...profile, current_class: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100" placeholder={t.class} /></div>
                  </FormSection>

                  {/* स्वास्थ्य और विशेष */}
                  <FormSection title={t.health} icon="🏥">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">{t.pregnant}</label><select value={profile.pregnant} onChange={e => setProfile({...profile, pregnant: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{YES_NO.map(y => <option key={y}>{y}</option>)}</select></div>
                      <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">{t.lactating}</label><select value={profile.lactating} onChange={e => setProfile({...profile, lactating: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{YES_NO.map(y => <option key={y}>{y}</option>)}</select></div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">{t.disability}</label><select value={profile.disability} onChange={e => setProfile({...profile, disability: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{YES_NO.map(y => <option key={y}>{y}</option>)}</select></div>
                      <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">{t.disabilityPercent}</label><input type="number" value={profile.disability_percent} onChange={e => setProfile({...profile, disability_percent: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100" placeholder={t.disabilityPercent} /></div>
                    </div>
                    <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">{t.pension}</label><select value={profile.pension_status} onChange={e => setProfile({...profile, pension_status: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{PENSION_STATUS.map(p => <option key={p}>{p}</option>)}</select></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">{t.senior}</label><select value={profile.is_senior_citizen} onChange={e => setProfile({...profile, is_senior_citizen: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{YES_NO.map(y => <option key={y}>{y}</option>)}</select></div>
                      <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">{t.destitute}</label><select value={profile.is_destitute} onChange={e => setProfile({...profile, is_destitute: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{YES_NO.map(y => <option key={y}>{y}</option>)}</select></div>
                    </div>
                  </FormSection>

                  {/* रोजगार विवरण */}
                  <FormSection title={t.employment} icon="👷">
                    <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">{t.empStatus}</label><select value={profile.employment_status} onChange={e => setProfile({...profile, employment_status: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{EMPLOYMENT_STATUS.map(s => <option key={s}>{s}</option>)}</select></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">{t.labourCard}</label><select value={profile.labour_card} onChange={e => setProfile({...profile, labour_card: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{YES_NO.map(y => <option key={y}>{y}</option>)}</select></div>
                      <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">{t.nregaCard}</label><select value={profile.mnega_card} onChange={e => setProfile({...profile, mnega_card: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{YES_NO.map(y => <option key={y}>{y}</option>)}</select></div>
                    </div>
                  </FormSection>

                  {/* किसान विवरण */}
                  <FormSection title={t.farmer} icon="🚜">
                    <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">{t.isFarmer}</label><select value={profile.is_farmer} onChange={e => setProfile({...profile, is_farmer: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{YES_NO.map(y => <option key={y}>{y}</option>)}</select></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">{t.landOwner}</label><select value={profile.land_owner} onChange={e => setProfile({...profile, land_owner: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{YES_NO.map(y => <option key={y}>{y}</option>)}</select></div>
                      <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">{t.pmKisan}</label><select value={profile.pm_kisan_beneficiary} onChange={e => setProfile({...profile, pm_kisan_beneficiary: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{YES_NO.map(y => <option key={y}>{y}</option>)}</select></div>
                    </div>
                  </FormSection>

                  {/* सरकारी नौकरी और आईडी */}
                  <FormSection title={t.govt} icon="📋">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">{t.selfGovt}</label><select value={profile.is_govt_employee} onChange={e => setProfile({...profile, is_govt_employee: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{GOVT_SERVICE.map(g => <option key={g}>{g}</option>)}</select></div>
                      <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">{t.famGovt}</label><select value={profile.family_govt_employee} onChange={e => setProfile({...profile, family_govt_employee: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{GOVT_SERVICE.map(g => <option key={g}>{g}</option>)}</select></div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">{t.janAadhar}</label><select value={profile.jan_aadhar_status} onChange={e => setProfile({...profile, jan_aadhar_status: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{YES_NO.map(y => <option key={y}>{y}</option>)}</select></div>
                      <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">{t.bankDbt}</label><select value={profile.bank_account_dbt} onChange={e => setProfile({...profile, bank_account_dbt: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100">{YES_NO.map(y => <option key={y}>{y}</option>)}</select></div>
                    </div>
                    <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">{t.phone}</label><input type="tel" value={profile.phone} onChange={e => setProfile({...profile, phone: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs ring-1 ring-slate-100" placeholder={t.phone} /></div>
                  </FormSection>

                </div>

                <div className="pt-6 text-center">
                  <button type="submit" className="w-full max-w-2xl py-6 bg-blue-600 text-white font-black rounded-3xl shadow-2xl hover:bg-blue-700 active:scale-95 transition-all uppercase tracking-widest text-base">
                    {t.submit}
                  </button>
                  <p className="mt-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Hybrid Search: Master Database + Real-time AI Analysis</p>
                </div>
              </form>
            )}

            {loading && (
              <div className="py-24 text-center space-y-12 flex flex-col items-center justify-center">
                <div className="w-24 h-24 border-8 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
                <div className="space-y-2">
                  <p className="font-black text-slate-800 text-2xl">{t.searching}</p>
                  <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">{t.insuranceHeader}</p>
                </div>
              </div>
            )}

            {result && !loading && (
              <div className="space-y-8 animate-slide-up mb-12">
                <div className="bg-white p-6 md:p-12 rounded-[3.5rem] shadow-2xl border border-slate-50">
                   <div className="flex justify-between items-center mb-10">
                     <h2 className="text-2xl font-black text-slate-800">{t.results} ({result.eligible_schemes.length})</h2>
                     <button onClick={() => setResult(null)} className="px-6 py-2 bg-slate-100 text-slate-500 font-black rounded-xl text-[10px] uppercase hover:bg-blue-50 hover:text-blue-600 transition-colors">{t.newForm}</button>
                   </div>
                   
                   <div className="bg-blue-50/50 p-6 rounded-3xl mb-8 text-sm font-bold text-slate-700 border border-blue-100 whitespace-pre-wrap leading-relaxed shadow-inner">
                      {result.hindiContent}
                   </div>

                   {/* Grounding Sources for AI transparency as per Gemini SDK guidelines */}
                   {result.groundingSources && result.groundingSources.length > 0 && (
                     <div className="mb-8 p-6 bg-slate-50 rounded-3xl border border-slate-200">
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">आधिकारिक संदर्भ (Sources)</h3>
                        <div className="flex flex-wrap gap-2">
                          {result.groundingSources.map((source, i) => {
                            const uri = source.web?.uri || source.maps?.uri;
                            const title = source.web?.title || source.maps?.title || uri;
                            if (!uri) return null;
                            return (
                              <a key={i} href={uri} target="_blank" rel="noreferrer" className="text-[9px] font-bold text-blue-600 hover:underline bg-white px-3 py-1.5 rounded-lg border border-slate-100 shadow-sm flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span> {title}
                              </a>
                            );
                          })}
                        </div>
                     </div>
                   )}

                   <SchemesTable schemes={result.eligible_schemes} />
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'features' && (
          <div className="max-w-5xl mx-auto space-y-16 animate-slide-up py-10">
            <section className="text-center space-y-4">
              <h2 className="text-4xl font-black text-slate-800">{t.fTitle}</h2>
              <p className="text-slate-500 font-bold text-lg">{t.fDesc}</p>
            </section>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[
                { title: t.f1, desc: t.f1d, icon: '⚡' },
                { title: t.f2, desc: t.f2d, icon: '🛡️' },
                { title: t.f3, desc: t.f3d, icon: '🌐' },
                { title: t.f4, desc: t.f4d, icon: '🧠' },
                { title: t.f5, desc: t.f5d, icon: '🗺️' },
                { title: t.f6, desc: t.f6d, icon: '🔐' }
              ].map((f, i) => (
                <div key={i} className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-50 hover:border-blue-200 transition-all group">
                  <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-3xl mb-6 group-hover:scale-110 transition-transform">{f.icon}</div>
                  <h3 className="text-lg font-black text-slate-800 mb-2">{f.title}</h3>
                  <p className="text-sm text-slate-500 font-bold leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
      <footer className="py-8 text-center text-slate-400 shrink-0">
        <p className="text-[9px] font-black uppercase tracking-[0.4em]">{t.title} • {t.desc} • Nagji Yadav</p>
      </footer>
    </div>
  );
};

export default App;
