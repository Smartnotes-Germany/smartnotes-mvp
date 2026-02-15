import { type Dispatch, type ReactNode, type SetStateAction, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
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
  StopCircle,
  Zap,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Timer,
  ShieldAlert,
  BarChart,
  HelpCircle,
  MessageSquareHeart,
} from 'lucide-react';
import { BrowserRouter, Navigate, Route, Routes, useNavigate, useLocation, Link } from 'react-router-dom';
import logoImage from './assets/images/logo.png';
import profileImage from './assets/images/profile.jpeg';

// --- Types & Logic ---

interface Question {
  id: string;
  topic: string;
  relevance: number;
  text: string;
  expectedKeywords: string[];
  solution: string;
  explanationTemplate: (userName: string, userAnswer: string, isCorrect: boolean) => string;
}

interface UserResponse {
  questionId: string;
  topic: string;
  answer: string;
  timeSpent: number;
  changes: number;
  score: number;
}

const userName = "Max";

const initialQuestions: Question[] = [
  {
    id: 'q1',
    topic: 'Zellatmung',
    relevance: 0.9,
    text: 'Welches Molekül ist der finale Elektronenakzeptor in der Atmungskette?',
    expectedKeywords: ['sauerstoff', 'o2'],
    solution: 'Sauerstoff (O2)',
    explanationTemplate: (name, answer, correct) =>
      correct
        ? `Ganz genau, ${name}. Sauerstoff ist am Ende der Kette unverzichtbar, um die Elektronen aufzunehmen.`
        : `Nein, ${name}, „${answer}“ ist in diesem Fall leider nicht der finale Akzeptor. Es ist der Sauerstoff (O2). Er saugt die Elektronen am Ende quasi auf, damit der Prozess nicht zum Stillstand kommt.`
  },
];

const questionPool: Question[] = [
  {
    id: 'q2',
    topic: 'ATP-Bilanz',
    relevance: 1.0,
    text: 'Wie viel ATP gewinnt eine Zelle netto pro Glukose nur durch Glykolyse?',
    expectedKeywords: ['2', 'zwei'],
    solution: '2 ATP',
    explanationTemplate: (name, answer, correct) =>
      correct
        ? `Korrekt, ${name}! 2 investiert, 4 raus, macht 2 Gewinn.`
        : `Nein, ${answer} ATP sind es nicht. Es sind tatsächlich nur 2 ATP netto. Zwar entstehen insgesamt 4, aber da die Zelle am Anfang 2 investieren muss, bleibt am Ende nur ein Gewinn von 2 übrig.`
  },
  {
    id: 'q3',
    topic: 'Stoffwechsel',
    relevance: 0.7,
    text: 'Wann kam das erste iPhone auf den Markt?',
    expectedKeywords: ['2007'],
    solution: '2007',
    explanationTemplate: (name, answer, correct) =>
      correct
        ? `Richtig, ${name}! Im Jahr 2007 hat das iPhone die Smartphone-Welt revolutioniert.`
        : `Nein, ${answer} war es leider noch nicht. Das erste iPhone kam erst im Jahr 2007 heraus. 2006 war es noch in der Entwicklung.`
  }
];

const calculateConfidenceScore = (isCorrect: boolean, time: number, changes: number, skipped: boolean = false) => {
  if (skipped) return 0;
  const accuracy = isCorrect ? 1 : 0;
  const timeScore = Math.max(0, Math.min(1, 1 - (time - 10) / 30));
  const changePenalty = Math.min(0.3, changes * 0.1);
  return Math.max(0, (accuracy * 0.6) + (timeScore * 0.3) - (changePenalty));
};

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
        <Link to="/dashboard" className="flex items-center gap-3 rounded-xl px-4 py-3 text-ink-secondary hover:bg-cream-light transition-all">
          <LayoutDashboard size={20} />
          <span className="text-[0.9rem] font-semibold">Dashboard</span>
        </Link>
        <div className="pt-6 pb-2"><h3 className="px-4 text-[0.65rem] font-bold uppercase tracking-[0.18em] text-ink-muted">Session</h3></div>
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || (item.path === '/start' && location.pathname === '/');
          const Icon = item.icon;
          return !item.enabled ? (
            <div key={item.path} className="flex items-center gap-3 px-4 py-3 text-ink-muted/30 cursor-not-allowed select-none"><Icon size={20} /><span className="text-[0.9rem] font-medium">{item.label}</span></div>
          ) : (
            <Link key={item.path} to={item.path} className={`flex items-center gap-3 rounded-xl px-4 py-3 transition-all ${isActive ? 'bg-accent text-cream shadow-lg' : 'text-ink-secondary hover:bg-cream-light'}`}>
              <item.icon size={20} /><span className="text-[0.9rem] font-semibold">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-cream-border p-4">
        <div className="flex items-center gap-3 px-2 py-3">
          <div className="h-10 w-10 rounded-full border-2 border-cream-border overflow-hidden shadow-sm shrink-0"><img src={profileImage} alt="Profile" className="h-full w-full object-cover" /></div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5"><p className="truncate text-[0.85rem] font-bold text-ink leading-tight">Max Mustermann</p><Settings size={14} className="text-ink-muted hover:text-accent cursor-pointer" /></div>
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
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-16 top-20 h-80 w-80 rounded-full bg-accent/5 blur-3xl" />
          <div className="absolute right-0 top-0 h-120 w-120 rounded-full bg-cream-dark/40 blur-3xl" />
        </div>
        <div className="relative mx-auto w-full max-w-5xl flex-1 flex flex-col">{children}</div>
      </main>
    </div>
  );
}

function StartPage({ files, setFiles, setFilesUploaded }: { files: string[], setFiles: Dispatch<SetStateAction<string[]>>, setFilesUploaded: (v: boolean) => void }) {
  const navigate = useNavigate();
  const [isUploading, setIsUploading] = useState(false);
  const handleUpload = () => { setIsUploading(true); setTimeout(() => { setFilesUploaded(true); navigate('/session'); }, 1000); };
  const removeFile = (name: string) => setFiles(prev => prev.filter(f => f !== name));

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex h-full min-h-0 flex-col gap-6 py-4">
      <header className="space-y-2 text-center">
        <h1 className="text-[2.4rem] md:text-[3rem] font-bold leading-tight tracking-tight text-ink">Unterlagen</h1>
        <p className="text-base font-medium text-ink-secondary md:text-lg">Lade deine Dokumente für das Training hoch.</p>
      </header>

      <div className="group relative rounded-[3rem] border-2 border-dashed border-cream-border bg-surface-white/40 hover:border-accent/30 transition-all duration-500">
        <div className="flex flex-col items-center justify-center p-8 text-center md:p-10">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/5 text-accent shadow-inner"><Upload size={32} /></div>
          <h2 className="text-xl font-bold tracking-tight text-ink">Hier ablegen</h2>
          <button className="mt-6 flex items-center gap-2 rounded-full border border-cream-border bg-surface-white px-8 py-3 text-[0.9rem] font-bold text-ink shadow-sm transition-all hover:bg-cream-light active:scale-95"><Plus size={18} />Datei auswählen</button>
        </div>
      </div>

      {files.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {files.map((file) => (
            <motion.div key={file} layout className="flex items-center justify-between gap-4 rounded-2xl border border-cream-border bg-surface-white/80 p-4 shadow-sm backdrop-blur-sm">
              <div className="flex items-center gap-3 overflow-hidden"><FileImage size={20} className="shrink-0 text-accent" /><span className="truncate text-[0.9rem] font-bold text-ink-secondary">{file}</span></div>
              <button onClick={() => removeFile(file)} className="text-ink-muted hover:text-red-500 transition-colors p-1"><X size={18} /></button>
            </motion.div>
          ))}
        </div>
      )}

      <div className="mt-auto flex justify-center pt-2">
        <button onClick={handleUpload} disabled={files.length === 0 || isUploading} className="group flex items-center gap-4 rounded-full bg-accent px-10 py-4 text-base font-bold text-cream shadow-2xl transition-all hover:-translate-y-1 active:scale-95 disabled:opacity-30">
          {isUploading ? <Loader2 size={24} className="animate-spin" /> : <>Training starten<ArrowRight size={26} className="transition-transform group-hover:translate-x-1" /></>}
        </button>
      </div>
    </motion.div>
  );
}

function StudySessionPage({ userResponses, setUserResponses, setQuestionsFinished }: { userResponses: UserResponse[], setUserResponses: Dispatch<SetStateAction<UserResponse[]>>, setQuestionsFinished: (v: boolean) => void }) {
  const navigate = useNavigate();
  const [activeQuestions, setActiveQuestions] = useState<Question[]>(initialQuestions);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [userInput, setUserInput] = useState('');
  const [changes, setChanges] = useState(0);
  const [startTime, setStartTime] = useState(() => Date.now());
  const [showFeedback, setShowFeedback] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  const currentTask = activeQuestions[currentIdx];

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUserInput(e.target.value);
    setChanges(prev => prev + 1);
  };

  const handleSkip = () => {
    const score = calculateConfidenceScore(false, 0, 0, true);
    setUserResponses(prev => [...prev, { questionId: currentTask.id, topic: currentTask.topic, answer: 'Übersprungen', timeSpent: 0, changes: 0, score }]);
    setIsCorrect(false);
    setShowFeedback(true);
  };

  const handleSubmit = () => {
    const timeSpent = (Date.now() - startTime) / 1000;
    const correct = currentTask.expectedKeywords.some(k => userInput.toLowerCase().includes(k.toLowerCase()));
    const score = calculateConfidenceScore(correct, timeSpent, changes);
    setUserResponses(prev => [...prev, { questionId: currentTask.id, topic: currentTask.topic, answer: userInput, timeSpent, changes, score }]);
    setIsCorrect(correct);
    setShowFeedback(true);
  };

  const nextQuestion = () => {
    setShowFeedback(false);
    setUserInput('');
    setChanges(0);
    setStartTime(Date.now());

    const available = questionPool.filter(q => !activeQuestions.find(aq => aq.id === q.id));
    available.sort((a, b) => b.relevance - a.relevance);

    if (available.length > 0) {
      setActiveQuestions(prev => [...prev, available[0]]);
      setCurrentIdx(prev => prev + 1);
    } else {
      setActiveQuestions(prev => [...prev, {
          id: `gen-${Date.now()}`,
          topic: 'Wiederholung',
          relevance: 0.5,
          text: `Erkläre mir kurz, ${userName}, was du heute als wichtigsten Punkt zur ${currentTask.topic} mitnimmst?`,
          expectedKeywords: ['relevanz'],
          solution: 'Individuelle Zusammenfassung',
          explanationTemplate: (n) => `Tolle Reflexion, ${n}! Genau dieses aktive Abrufen festigt dein Wissen für den Test.`
      }]);
      setCurrentIdx(prev => prev + 1);
    }
  };

  return (
    <div className="flex-1 flex flex-col py-10">
      <header className="mb-20 space-y-4 text-center">
        <div className="flex items-center justify-center gap-4 text-accent">
           <div className="flex items-center gap-2"><Timer size={14} /><span className="text-[0.7rem] font-bold uppercase tracking-widest">Analyse aktiv</span></div>
           <div className="h-1 w-1 rounded-full bg-cream-border" />
           <div className="flex items-center gap-2"><CheckCircle2 size={14} /><span className="text-[0.7rem] font-bold uppercase tracking-widest">{userResponses.length} Beantwortet</span></div>
        </div>
        <div className="h-1.5 w-full bg-cream-dark/20 rounded-full overflow-hidden relative"><motion.div className="h-full bg-accent" animate={{ width: `${Math.min((userResponses.length / 5) * 100, 100)}%` }} /></div>
      </header>

      <div className="flex-1 flex flex-col items-center">
        <AnimatePresence mode="wait">
          {!showFeedback ? (
            <motion.div key={currentTask.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="w-full text-center">
              <span className="inline-block px-3 py-1 rounded-full bg-accent/5 text-accent text-[0.65rem] font-bold uppercase tracking-widest mb-6">{currentTask.topic}</span>
              <h2 className="text-[2.2rem] md:text-[2.8rem] font-bold leading-tight tracking-tight text-ink mb-16">{currentTask.text}</h2>
              <div className="relative max-w-xl mx-auto group mb-12"><input type="text" value={userInput} onChange={handleInputChange} autoFocus placeholder="Deine Antwort..." className="w-full bg-transparent border-b-2 border-cream-border py-4 px-2 text-xl font-medium outline-none focus:border-accent transition-colors text-center" onKeyDown={(e) => e.key === 'Enter' && userInput.length > 0 && handleSubmit()} /></div>
              <button onClick={handleSkip} className="flex items-center gap-2 mx-auto text-ink-muted hover:text-accent transition-all text-[0.7rem] font-bold uppercase tracking-widest"><HelpCircle size={16} />Weiß ich gerade nicht</button>
            </motion.div>
          ) : (
            <motion.div key="feedback" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-2xl bg-surface-white rounded-[2.5rem] p-10 border border-cream-border shadow-xl text-center">
              <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-6 ${isCorrect ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>{isCorrect ? <CheckCircle2 size={32} /> : <AlertCircle size={32} />}</div>
              <div className="flex items-center justify-center gap-2 mb-2 text-accent">
                <MessageSquareHeart size={16} />
                <p className="text-[0.7rem] font-bold uppercase tracking-widest">{isCorrect ? 'Super!' : 'Klarstellung'}</p>
              </div>
              <p className="text-xl font-bold mb-6">{isCorrect ? 'Völlig richtig!' : 'Nicht ganz...'}</p>
              <div className="bg-cream-light/30 rounded-2xl p-8 text-left mb-8 border border-cream-border/50">
                <p className="text-[1.1rem] leading-relaxed text-ink-secondary font-medium italic">
                  „{currentTask.explanationTemplate(userName, userInput, isCorrect)}“
                </p>
              </div>
              <button onClick={nextQuestion} className="w-full rounded-full bg-ink py-4 text-cream font-bold flex items-center justify-center gap-2 hover:bg-accent transition-colors">Nächste Frage <ArrowRight size={18} /></button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <footer className="mt-20 flex justify-center border-t border-cream-border/50 pt-8 w-full"><button onClick={() => { setQuestionsFinished(true); navigate('/sicherheit'); }} className="flex items-center gap-2 text-[0.65rem] font-bold uppercase tracking-[0.2em] text-ink-muted hover:text-ink transition-colors"><StopCircle size={14} />Session Beenden</button></footer>
    </div>
  );
}

function ConfidencePage({ userResponses }: { userResponses: UserResponse[] }) {
  const navigate = useNavigate();
  const analysis = useMemo(() => {
    const topics: Record<string, { scores: number[], relevance: number }> = {};
    userResponses.forEach(res => {
      const q = [...initialQuestions, ...questionPool].find(q => q.id === res.questionId) || { relevance: 0.5 };
      if (!topics[res.topic]) topics[res.topic] = { scores: [], relevance: q.relevance };
      topics[res.topic].scores.push(res.score);
    });
    return Object.entries(topics).map(([name, data]) => {
      const avg = data.scores.reduce((a, b) => a + b, 0) / data.scores.length;
      let status: 'green' | 'yellow' | 'red' = 'red';
      if (avg > 0.75) status = 'green'; else if (avg > 0.45) status = 'yellow';
      return { name, score: Math.round(avg * 100), status, relevance: data.relevance };
    }).sort((a, b) => a.score - b.score);
  }, [userResponses]);

  const biggestWeakness = analysis[0];
  const overallProgress = Math.round(analysis.reduce((acc, curr) => acc + curr.score, 0) / (analysis.length || 1));

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-12 py-6 w-full">
      <header className="grid md:grid-cols-2 gap-8 items-center mb-16">
        <div className="text-left"><h1 className="text-[3rem] font-bold tracking-tight leading-none mb-4">Ergebnis</h1><p className="text-ink-secondary text-lg font-medium">Deine heutige Lernlücken-Analyse.</p></div>
        <div className="bg-surface-white rounded-[2.5rem] p-8 border border-cream-border shadow-sm flex items-center justify-between"><div><p className="text-[0.65rem] font-bold uppercase tracking-widest text-accent mb-1">Knowledge Growth</p><p className="text-3xl font-bold text-ink">+{overallProgress}%</p></div><div className="h-16 w-16 rounded-full border-4 border-accent/20 border-t-accent flex items-center justify-center"><TrendingUp size={24} className="text-accent" /></div></div>
      </header>

      {biggestWeakness && (
        <section className="bg-red-50 border border-red-100 rounded-[2.5rem] p-10 relative overflow-hidden">
          <div className="absolute -right-5 -top-5 opacity-10 text-red-600 rotate-12"><ShieldAlert size={200} /></div>
          <div className="relative z-10"><span className="inline-block px-3 py-1 rounded-full bg-red-600 text-white text-[0.6rem] font-bold uppercase tracking-widest mb-4">Größte Lernlücke</span><h2 className="text-3xl font-bold text-red-900 mb-2">{biggestWeakness.name}</h2><p className="text-red-700 max-w-lg mb-8 font-medium italic">Hey {userName}, hier haben wir gemeinsam den größten Nachholbedarf festgestellt. Wollen wir das gezielt angehen?</p><button onClick={() => navigate('/session')} className="rounded-full bg-red-600 px-8 py-3 text-white font-bold text-sm hover:bg-red-700 transition-all flex items-center gap-2">Deep-Dive starten <Zap size={14} fill="white" /></button></div>
        </section>
      )}

      <section className="space-y-6">
        <h2 className="text-[0.8rem] font-bold uppercase tracking-widest text-ink/40 px-2">Themen-Status</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {analysis.map((topic) => (
            <div key={topic.name} className={`rounded-4xl border-2 p-8 transition-all hover:-translate-y-1 ${topic.status === 'green' ? 'bg-emerald-50/30 border-emerald-100' : topic.status === 'yellow' ? 'bg-amber-50/30 border-amber-100' : 'bg-red-50/30 border-red-100'}`}>
              <div className="flex justify-between items-start mb-6"><div className={`p-3 rounded-2xl ${topic.status === 'green' ? 'bg-emerald-100 text-emerald-600' : topic.status === 'yellow' ? 'bg-amber-100 text-amber-600' : 'bg-red-100 text-red-600'}`}>{topic.status === 'green' ? <CheckCircle2 size={20} /> : topic.status === 'yellow' ? <BarChart size={20} /> : <AlertCircle size={20} />}</div><span className={`text-2xl font-bold ${topic.status === 'green' ? 'text-emerald-700' : topic.status === 'yellow' ? 'text-amber-700' : 'text-red-700'}`}>{topic.score}%</span></div>
              <p className="font-bold text-ink text-lg tracking-tight mb-1">{topic.name}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="flex justify-center pt-8"><button onClick={() => navigate('/start')} className="text-[0.7rem] font-bold text-ink-muted uppercase tracking-[0.2em] hover:text-ink transition-colors">Neue Session</button></div>
    </motion.div>
  );
}

function App() {
  const [files, setFiles] = useState(['Bio.pdf']);
  const [userResponses, setUserResponses] = useState<UserResponse[]>([]);
  const [filesUploaded, setFilesUploaded] = useState(false);
  const [questionsFinished, setQuestionsFinished] = useState(false);

  return (
    <BrowserRouter>
      <MainLayout filesUploaded={filesUploaded} questionsFinished={questionsFinished}>
        <Routes>
          <Route path="/" element={<Navigate to="/start" replace />} />
          <Route path="/start" element={<StartPage files={files} setFiles={setFiles} setFilesUploaded={setFilesUploaded} />} />
          <Route path="/session" element={<StudySessionPage userResponses={userResponses} setUserResponses={setUserResponses} setQuestionsFinished={setQuestionsFinished} />} />
          <Route path="/sicherheit" element={<ConfidencePage userResponses={userResponses} />} />
          <Route path="*" element={<Navigate to="/start" replace />} />
        </Routes>
      </MainLayout>
    </BrowserRouter>
  );
}

export default App;
