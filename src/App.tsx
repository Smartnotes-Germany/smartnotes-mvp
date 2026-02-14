import { type Dispatch, type ReactNode, type SetStateAction, useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  FileImage,
  Loader2,
  Upload,
  LayoutDashboard,
  Files,
  BarChart3,
  Settings,
  Plus,
  X,
  Target,
  StopCircle,
  Zap,
  Smile,
  Meh,
  Frown,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Clock,
  BookOpen,
  Sparkles,
} from 'lucide-react';
import { BrowserRouter, Navigate, Route, Routes, useNavigate, useLocation, Link } from 'react-router-dom';
import logoImage from './assets/images/logo.png';
import profileImage from './assets/images/profile.jpeg';

// --- Types & Data ---

type QuestionType = 'Offene Frage' | 'Rechenaufgabe' | 'Verständnis' | 'Transfer';

interface Question {
  id: string;
  topic: string;
  type: QuestionType;
  text: string;
  solution: string;
  explanation: string;
}

const initialQuestions: Question[] = [
  {
    id: 'q1',
    topic: 'Sauerstoffmangel',
    type: 'Offene Frage',
    text: 'Warum entsteht bei Sauerstoffmangel weniger ATP?',
    solution: 'Die Atmungskette stoppt ohne Sauerstoff.',
    explanation: 'Sauerstoff ist notwendig, um Elektronen am Ende der Atmungskette aufzunehmen. Fehlt er, bricht die effiziente Produktion zusammen und die Zelle nutzt die weniger effektive Gärung.'
  },
];

const questionPool: Question[] = [
  {
    id: 'q2',
    topic: 'ATP-Bilanz',
    type: 'Rechnen',
    text: 'Wie viel ATP liefern 2 Moleküle Glukose?',
    solution: 'Ca. 60-64 ATP.',
    explanation: 'Pro Glukose entstehen etwa 30-32 ATP. Bei zwei Molekülen verdoppelt sich der Ertrag.'
  },
  {
    id: 'q3',
    topic: 'Stoffwechsel',
    type: 'Verständnis',
    text: 'Was ist der Hauptvorteil aerober Prozesse?',
    solution: 'Vollständiger Abbau und hohe Energieausbeute.',
    explanation: 'Aerobe Prozesse nutzen Sauerstoff, um Glukose komplett zu zerlegen, was deutlich mehr Energie freisetzt als anaerobe Wege.'
  }
];

const deepDivePool: Question[] = [
  {
    id: 'dd1',
    topic: 'ATP-Bilanz',
    type: 'Transfer',
    text: 'Wie verändert sich die ATP-Bilanz, wenn nur die Glykolyse abläuft?',
    solution: 'Es entstehen nur 2 ATP netto.',
    explanation: 'Ohne Citratzyklus und Atmungskette bleibt nur der geringe Ertrag der Glykolyse. Das ist der Grund, warum anaerobes Training so schnell ermüdet.'
  },
  {
    id: 'dd2',
    topic: 'ATP-Bilanz',
    type: 'Rechenaufgabe',
    text: 'Berechne den ATP-Ertrag für 5 Moleküle Pyruvat, die direkt in den Citratzyklus gehen.',
    solution: 'Etwa 62-75 ATP.',
    explanation: 'Ein Pyruvat liefert im Citratzyklus und der Atmungskette ca. 12.5 bis 15 ATP. Bei 5 Molekülen multipliziert sich dies entsprechend.'
  }
];

const allQuestions = [...initialQuestions, ...questionPool, ...deepDivePool];

type SelfCheckRating = 'sicher' | 'teilweise' | 'unsicher';
type UnderstandingRatings = Record<string, SelfCheckRating | undefined>;

const selfCheckOptions: Array<{ id: SelfCheckRating; label: string; helper: string; icon: any; color: string }> = [
  { id: 'unsicher', label: 'Unsicher', helper: 'Lösung zeigen', icon: Frown, color: 'border-red-100 bg-red-50/40 text-red-700 hover:border-red-200' },
  { id: 'teilweise', label: 'Teilweise', helper: 'Fast da', icon: Meh, color: 'border-amber-100 bg-amber-50/40 text-amber-700 hover:border-amber-200' },
  { id: 'sicher', label: 'Sicher', helper: 'Verstanden', icon: Smile, color: 'border-emerald-100 bg-emerald-50/40 text-emerald-700 hover:border-emerald-200' },
];

const ratingToScore: Record<SelfCheckRating, number> = { sicher: 100, teilweise: 60, unsicher: 20 };

// --- Components ---

function Sidebar({ filesUploaded, questionsFinished }: { filesUploaded: boolean, questionsFinished: boolean }) {
  const location = useLocation();
  const navItems = [
    { icon: Files, label: '1. Unterlagen', path: '/start', enabled: true },
    { icon: Zap, label: '2. Training', path: '/session', enabled: filesUploaded },
    { icon: BarChart3, label: '3. Ergebnis', path: '/sicherheit', enabled: questionsFinished },
  ];

  return (
    <aside className="fixed left-0 top-0 hidden h-full w-64 flex-col border-r border-cream-border bg-surface-white/80 backdrop-blur-md md:flex z-50">
      <div className="flex items-center gap-3 p-6 pt-8">
        <div className="h-10 w-10 overflow-hidden rounded-xl border border-cream-border shadow-sm">
          <img src={logoImage} alt="Logo" className="h-full w-full object-cover" />
        </div>
        <p className="text-[1.1rem] font-bold uppercase tracking-[0.12em] text-accent leading-none">Smartnotes</p>
      </div>

      <nav className="flex-1 px-3 py-6 space-y-2">
        <Link
          to="/dashboard"
          className={`flex items-center gap-3 rounded-xl px-4 py-3 transition-all ${
            location.pathname === '/dashboard' ? 'bg-accent text-cream shadow-lg' : 'text-ink-secondary hover:bg-cream-light'
          }`}
        >
          <LayoutDashboard size={20} />
          <span className="text-[0.9rem] font-semibold">Dashboard</span>
        </Link>
        
        <div className="pt-6 pb-2">
           <h3 className="px-4 text-[0.65rem] font-bold uppercase tracking-[0.18em] text-ink-muted">Session</h3>
        </div>
        
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || (item.path === '/start' && location.pathname === '/');
          const Icon = item.icon;
          return !item.enabled ? (
            <div key={item.path} className="flex items-center gap-3 px-4 py-3 text-ink-muted/30 cursor-not-allowed select-none">
              <Icon size={20} />
              <span className="text-[0.9rem] font-medium">{item.label}</span>
            </div>
          ) : (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 transition-all ${
                isActive ? 'bg-accent text-cream shadow-lg' : 'text-ink-secondary hover:bg-cream-light'
              }`}
            >
              <Icon size={20} />
              <span className="text-[0.9rem] font-semibold">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-cream-border p-4">
        <div className="flex items-center gap-3 px-2 py-3">
          <div className="h-10 w-10 rounded-full border-2 border-cream-border overflow-hidden shadow-sm shrink-0">
            <img src={profileImage} alt="Profile" className="h-full w-full object-cover" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
               <p className="truncate text-[0.85rem] font-bold text-ink leading-tight">Max Mustermann</p>
               <Settings size={14} className="text-ink-muted cursor-pointer hover:text-accent transition-colors shrink-0" />
            </div>
            <p className="truncate text-[0.7rem] text-ink-muted font-medium">Premium Account</p>
          </div>
        </div>
      </div>
    </aside>
  );
}

function MainLayout({ children, filesUploaded, questionsFinished }: { children: ReactNode, filesUploaded: boolean, questionsFinished: boolean }) {
  return (
    <div className="min-h-screen bg-cream text-ink flex">
      <Sidebar filesUploaded={filesUploaded} questionsFinished={questionsFinished} />
      <main className="flex-1 md:ml-64 p-6 md:p-12 lg:p-16 relative flex flex-col items-center">
        <div className="relative w-full max-w-5xl flex-1 flex flex-col">
          {children}
        </div>
      </main>
    </div>
  );
}

function StartPage({ files, setFiles, setFilesUploaded }: { files: string[], setFiles: Dispatch<SetStateAction<string[]>>, setFilesUploaded: (v: boolean) => void }) {
  const navigate = useNavigate();
  const [isUploading, setIsUploading] = useState(false);
  const handleUpload = () => { setIsUploading(true); setTimeout(() => { setFilesUploaded(true); navigate('/session'); }, 1000); };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-16 py-10">
      <header className="text-center">
        <h1 className="editorial-heading text-[3.5rem] tracking-tight">Unterlagen</h1>
        <p className="mt-3 text-ink-secondary text-lg">Lade deine Dokumente für das Training hoch.</p>
      </header>

      <div className="group relative rounded-[2.5rem] border-2 border-dashed border-cream-border bg-surface-white/40 hover:border-accent/30 transition-all">
        <div className="flex flex-col items-center justify-center p-20 text-center">
          <div className="mb-6 text-accent/20"><Upload size={48} /></div>
          <button className="rounded-full bg-ink px-10 py-4 text-sm font-bold text-cream transition-all hover:scale-105 active:scale-95">Datei auswählen</button>
        </div>
      </div>

      <div className="flex justify-center">
        <button onClick={handleUpload} disabled={files.length === 0 || isUploading} className="flex items-center gap-3 rounded-full bg-accent px-12 py-5 text-lg font-bold text-cream shadow-xl transition-all hover:translate-y-[-2px] disabled:opacity-20">
          {isUploading ? <Loader2 size={24} className="animate-spin" /> : <>Starten <ArrowRight size={22} /></>}
        </button>
      </div>
    </motion.div>
  );
}

function StudySessionPage({ 
  ratings, 
  setRatings, 
  setQuestionsFinished,
  sessionType 
}: { 
  ratings: UnderstandingRatings, 
  setRatings: Dispatch<SetStateAction<UnderstandingRatings>>, 
  setQuestionsFinished: (v: boolean) => void,
  sessionType: 'normal' | 'deep-dive'
}) {
  const navigate = useNavigate();
  const [activeQuestions, setActiveQuestions] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [showExplanation, setShowExplanation] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate smart question generation based on type
    setTimeout(() => {
        if (sessionType === 'deep-dive') {
            setActiveQuestions([deepDivePool[0]]);
        } else {
            setActiveQuestions(initialQuestions);
        }
        setLoading(false);
    }, 800);
  }, [sessionType]);

  const currentTask = activeQuestions[currentIdx];
  const answeredCount = Object.keys(ratings).length;
  
  const currentPhase = useMemo(() => {
    if (sessionType === 'deep-dive') return "Gezieltes Training: ATP-Bilanzen";
    if (answeredCount < 2) return "Basis-Check";
    if (answeredCount < 4) return "Analyse des Verständnisses";
    return "Vertiefungsphase";
  }, [answeredCount, sessionType]);

  const handleSelect = (rating: SelfCheckRating) => {
    setRatings(prev => ({ ...prev, [currentTask.id]: rating }));
    if (rating === 'unsicher') setShowExplanation(true);
    else nextQuestion();
  };

  const nextQuestion = () => {
    setShowExplanation(false);
    const pool = sessionType === 'deep-dive' ? deepDivePool : questionPool;
    const available = pool.filter(q => !activeQuestions.find(aq => aq.id === q.id));
    
    setActiveQuestions(prev => [...prev, available[0] || { 
        id: `gen-${Date.now()}`, 
        topic: sessionType === 'deep-dive' ? 'ATP-Bilanz' : 'Vertiefung', 
        text: sessionType === 'deep-dive' ? 'Erkläre einen weiteren Spezialfall der ATP-Bilanz.' : 'Beschreibe ein weiteres Detail des Themas.', 
        solution: 'Individuell.', 
        explanation: 'Klasse, dass du dranbleibst!' 
    }]);
    setCurrentIdx(prev => prev + 1);
  };

  if (loading) return (
    <div className="flex-1 flex flex-col items-center justify-center space-y-4">
        <Sparkles size={40} className="text-accent animate-pulse" />
        <p className="text-ink-secondary font-bold uppercase tracking-widest text-sm">Bereite Deep-Dive vor...</p>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col py-10">
      <header className="mb-20 space-y-4 text-center">
        <div className="flex items-center justify-center gap-2">
           <span className={`text-[0.7rem] font-bold uppercase tracking-[0.2em] animate-pulse ${sessionType === 'deep-dive' ? 'text-emerald-600' : 'text-accent'}`}>
             {currentPhase}
           </span>
        </div>
        <div className="h-1.5 w-full bg-cream-dark/20 rounded-full overflow-hidden relative">
          <motion.div className="h-full bg-accent" animate={{ width: `${Math.min((answeredCount / 6) * 100, 100)}%` }} />
        </div>
      </header>

      <div className="flex-1 flex flex-col relative min-h-[400px]">
        <AnimatePresence mode="wait">
          <motion.div key={currentTask.id + (showExplanation ? '-e' : '')} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex-1 flex flex-col">
            <h2 className="text-[2.5rem] md:text-[3.2rem] font-bold leading-tight tracking-tight text-ink mb-20 text-center">
              {currentTask.text}
            </h2>

            <div className="mt-auto">
              {!showExplanation ? (
                <div className="grid gap-4 sm:grid-cols-3">
                  {selfCheckOptions.map((opt) => (
                    <button key={opt.id} onClick={() => handleSelect(opt.id)} className={`flex flex-col items-center rounded-3xl border-2 p-8 transition-all hover:scale-[1.02] active:scale-95 ${opt.color}`}>
                      <opt.icon size={28} className="mb-4" />
                      <span className="text-lg font-bold tracking-tight">{opt.label}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="rounded-[2.5rem] bg-surface-white p-10 shadow-xl border border-cream-border text-center">
                  <p className="text-xl font-bold mb-4">{currentTask.solution}</p>
                  <p className="text-ink-secondary leading-relaxed mb-8">{currentTask.explanation}</p>
                  <button onClick={nextQuestion} className="rounded-full bg-ink px-10 py-4 text-cream font-bold transition-all hover:bg-accent">Weiter</button>
                </motion.div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <footer className="mt-20 flex justify-between items-center opacity-40 hover:opacity-100 transition-opacity">
        <button onClick={() => navigate('/start')} className="text-sm font-bold uppercase tracking-widest">Abbrechen</button>
        <button onClick={() => { setQuestionsFinished(true); navigate('/sicherheit'); }} className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest"><StopCircle size={16} /> Beenden</button>
      </footer>
    </div>
  );
}

function ConfidencePage({ 
  ratings, 
  onRestart,
  onDeepDive 
}: { 
  ratings: UnderstandingRatings, 
  onRestart: () => void,
  onDeepDive: () => void
}) {
  const navigate = useNavigate();
  const answeredIds = Object.keys(ratings);
  const totalQuestions = answeredIds.length;

  const topicResults = useMemo(() => {
    const results: Record<string, { total: number, score: number }> = {};
    answeredIds.forEach(id => {
      const q = allQuestions.find(aq => aq.id === id) || { topic: 'Allgemein' };
      const rating = ratings[id];
      if (!results[q.topic]) results[q.topic] = { total: 0, score: 0 };
      results[q.topic].total += 1;
      results[q.topic].score += rating ? ratingToScore[rating] : 0;
    });
    return Object.entries(results).map(([name, data]) => ({
      name,
      percentage: Math.round(data.score / data.total)
    }));
  }, [ratings, answeredIds]);

  const avgScore = totalQuestions > 0 
    ? Math.round(topicResults.reduce((acc, curr) => acc + curr.percentage, 0) / topicResults.length) 
    : 0;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-12 py-6 w-full">
      <div className="grid lg:grid-cols-[1fr_2fr] gap-8">
        <div className="space-y-6">
          <div className="bg-surface-white rounded-[2.5rem] p-10 border border-cream-border shadow-sm text-center">
            <div className="mx-auto mb-6 flex h-32 w-32 items-center justify-center rounded-full bg-accent text-cream text-[3rem] font-bold shadow-xl shadow-accent/20">
              {avgScore}%
            </div>
            <h1 className="editorial-heading text-[2.5rem] tracking-tight mb-2">Fertig!</h1>
            <p className="text-ink-secondary font-medium italic">Dein Ergebnis</p>
          </div>

          <div className="bg-surface-white rounded-[2.5rem] p-8 border border-cream-border shadow-sm grid grid-cols-2 gap-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-accent">
                <BookOpen size={16} />
                <span className="text-[0.65rem] font-bold uppercase tracking-widest">Fragen</span>
              </div>
              <p className="text-2xl font-bold text-ink">{totalQuestions}</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-accent">
                <Clock size={16} />
                <span className="text-[0.65rem] font-bold uppercase tracking-widest">Dauer</span>
              </div>
              <p className="text-2xl font-bold text-ink">~4m</p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-surface-white rounded-[2.5rem] p-8 border border-cream-border shadow-sm">
            <h2 className="text-[0.8rem] font-bold uppercase tracking-widest text-ink/40 mb-6 px-2">Themen-Analyse</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {topicResults.map((topic) => (
                <div key={topic.name} className="bg-cream-light/30 rounded-2xl p-5 border border-cream-border/50">
                  <div className="flex justify-between items-start mb-3">
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${topic.percentage >= 80 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {topic.percentage >= 80 ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                    </div>
                    <span className="text-xl font-bold text-accent">{topic.percentage}%</span>
                  </div>
                  <p className="font-bold text-ink tracking-tight mb-1">{topic.name}</p>
                  <p className="text-[0.7rem] text-ink-secondary font-bold uppercase tracking-wider">
                    {topic.percentage >= 80 ? 'Sicher' : 'Wiederholen'}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-ink rounded-[2.5rem] p-8 text-cream shadow-2xl relative overflow-hidden group">
            <div className="absolute -right-10 -bottom-10 h-40 w-40 rounded-full bg-accent/20 blur-3xl group-hover:bg-accent/30 transition-all" />
            <h2 className="text-[0.8rem] font-bold uppercase tracking-widest text-cream/40 mb-4">KI-Empfehlung</h2>
            <p className="text-[1.1rem] font-bold leading-snug mb-6">
              Soll ich für dich neue Fragen zu <span className="text-accent underline underline-offset-4 decoration-2">ATP-Bilanzen</span> heraussuchen? Ich nutze dafür deine Notizen und Online-Quellen.
            </p>
            <button onClick={onDeepDive} className="relative z-10 w-full rounded-full bg-cream py-4 text-ink font-bold transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2">
              <Zap size={18} fill="currentColor" />
              Deep-Dive starten
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function App() {
  const [files, setFiles] = useState(['Bio.pdf']);
  const [understandingRatings, setUnderstandingRatings] = useState<UnderstandingRatings>({});
  const [filesUploaded, setFilesUploaded] = useState(false);
  const [questionsFinished, setQuestionsFinished] = useState(false);
  const [sessionType, setSessionType] = useState<'normal' | 'deep-dive'>('normal');

  const startNewNormalSession = () => {
    setUnderstandingRatings({});
    setFilesUploaded(false);
    setQuestionsFinished(false);
    setSessionType('normal');
  };

  const startDeepDiveSession = () => {
    setUnderstandingRatings({});
    setQuestionsFinished(false);
    setSessionType('deep-dive');
  };

  return (
    <BrowserRouter>
      <MainLayout filesUploaded={filesUploaded || sessionType === 'deep-dive'} questionsFinished={questionsFinished}>
        <Routes>
          <Route path="/" element={<Navigate to="/start" replace />} />
          <Route path="/start" element={<StartPage files={files} setFiles={setFiles} setFilesUploaded={setFilesUploaded} />} />
          <Route 
            path="/session" 
            element={
                <StudySessionPage 
                    ratings={understandingRatings} 
                    setRatings={setUnderstandingRatings} 
                    setQuestionsFinished={setQuestionsFinished} 
                    sessionType={sessionType}
                />
            } 
          />
          <Route 
            path="/sicherheit" 
            element={
                <ConfidencePage 
                    ratings={understandingRatings} 
                    onRestart={startNewNormalSession} 
                    onDeepDive={startDeepDiveSession}
                />
            } 
          />
          <Route path="*" element={<Navigate to="/start" replace />} />
        </Routes>
      </MainLayout>
    </BrowserRouter>
  );
}

export default App;
