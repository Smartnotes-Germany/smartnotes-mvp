import { motion } from 'framer-motion';
import { Trophy, TrendingUp, Target, Clock, Sparkles, ArrowUpRight, BookOpen, Brain, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  subtitle?: string;
  delay?: number;
}

const StatCard = ({ icon: Icon, label, value, subtitle, delay = 0 }: StatCardProps) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.5 }}
    className="card-editorial group cursor-pointer"
  >
    <div className="flex items-start justify-between mb-6">
      <div>
        <span className="text-caption text-text-muted block mb-2">{label}</span>
        <span className="font-display text-3xl font-medium text-ink">{value}</span>
      </div>
      <div className="w-12 h-12 border border-ivory-muted flex items-center justify-center group-hover:border-ink group-hover:bg-ink group-hover:text-ivory transition-all">
        <Icon size={20} />
      </div>
    </div>
    {subtitle && (
      <p className="text-body-md text-text-secondary">{subtitle}</p>
    )}
  </motion.div>
);

interface ProgressBarProps {
  subject: string;
  progress: number;
  color: string;
  delay?: number;
}

const ProgressBar = ({ subject, progress, color, delay = 0 }: ProgressBarProps) => (
  <motion.div
    initial={{ opacity: 0, x: -20 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay, duration: 0.5 }}
    className="group"
  >
    <div className="flex justify-between items-end mb-3">
      <span className="font-body text-text-primary">{subject}</span>
      <span className="text-caption text-text-muted">{progress}%</span>
    </div>
    <div className="h-1 bg-ivory-muted overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${progress}%` }}
        transition={{ delay: delay + 0.3, duration: 1, ease: "easeOut" }}
        className={`h-full ${color}`}
      />
    </div>
  </motion.div>
);

export const Progress = () => {
  const navigate = useNavigate();

  const subjects = [
    { subject: "Biologie: Genetik", progress: 92, color: "bg-accent-forest" },
    { subject: "Mathe: Analysis", progress: 65, color: "bg-accent-gold" },
    { subject: "Geschichte: Antike", progress: 45, color: "bg-accent-burnt" },
    { subject: "Englisch: Grammatik", progress: 88, color: "bg-accent-forest" },
  ];

  return (
    <div className="h-full bg-ivory p-10 overflow-y-auto">
      <div className="max-w-6xl mx-auto">
        
        {/* === HEADER === */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12"
        >
          <p className="text-caption text-accent-slate mb-2">Dashboard</p>
          <h1 className="text-display-md text-ink mb-4">Dein Lernfortschritt</h1>
          <p className="text-body-lg text-text-secondary max-w-2xl">
            Du machst großartige Fortschritte. Hier ist deine Übersicht über Wissenslücken und Erfolge.
          </p>
        </motion.div>

        {/* === STATS GRID === */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <StatCard 
            icon={Trophy} 
            label="Gesamterfolg" 
            value="78%" 
            subtitle="Bewertung durch KI"
            delay={0.1}
          />
          <StatCard 
            icon={TrendingUp} 
            label="Lernstreak" 
            value="12 Tage" 
            subtitle="Persönlicher Rekord"
            delay={0.2}
          />
          <StatCard 
            icon={Target} 
            label="Fokus-Themen" 
            value="4 Aktiv" 
            subtitle="Empfohlene Prioritäten"
            delay={0.3}
          />
          <StatCard 
            icon={Clock} 
            label="Lernzeit" 
            value="14.5 Std" 
            subtitle="Diese Woche"
            delay={0.4}
          />
        </div>

        {/* === MAIN CONTENT GRID === */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Progress Analysis */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="lg:col-span-2 card-editorial"
          >
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="font-display text-2xl font-medium mb-2">Wissensanalyse</h3>
                <p className="text-body-md text-text-secondary">Fortschritt nach Fachbereich</p>
              </div>
              <div className="flex items-center gap-2 text-caption text-text-muted">
                <Brain size={14} />
                <span>KI-basiert</span>
              </div>
            </div>
            
            <div className="space-y-8">
              {subjects.map((item, i) => (
                <div key={item.subject}>
                  <ProgressBar 
                    subject={item.subject} 
                    progress={item.progress} 
                    color={item.color}
                    delay={0.6 + i * 0.1}
                  />
                  {item.progress < 50 && (
                    <motion.button
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 1 + i * 0.1 }}
                      onClick={() => navigate('/4')}
                      className="mt-3 flex items-center gap-2 text-caption text-accent-burnt hover:text-ink transition-colors"
                    >
                      <Target size={12} /> 
                      <span>Fokus empfohlen</span>
                      <ArrowUpRight size={12} />
                    </motion.button>
                  )}
                </div>
              ))}
            </div>
          </motion.div>

          {/* AI Coach Card */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="card-dark relative overflow-hidden"
          >
            {/* Decorative Elements */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-accent-gold/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-accent-burnt/10 rounded-full blur-2xl" />
            
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-6">
                <Sparkles size={18} className="text-accent-gold" />
                <span className="text-caption text-accent-gold">Smart Coach</span>
              </div>
              
              <h3 className="font-display text-3xl font-medium mb-6 leading-tight">
                "Du hast Probleme mit der Antike?"
              </h3>
              
              <p className="text-body-md text-ivory/70 mb-8 leading-relaxed">
                Ich habe bemerkt, dass du bei den Quizfragen zum Römischen Reich oft zögerst. Ich habe ein spezielles 5-Minuten-Training zusammengestellt.
              </p>
              
              <div className="space-y-4 mb-8">
                <div className="flex items-center gap-3 text-body-md text-ivory/60">
                  <Zap size={14} className="text-accent-gold" />
                  <span>5 Minuten Training</span>
                </div>
                <div className="flex items-center gap-3 text-body-md text-ivory/60">
                  <BookOpen size={14} className="text-accent-gold" />
                  <span>3 Quiz-Fragen</span>
                </div>
                <div className="flex items-center gap-3 text-body-md text-ivory/60">
                  <Target size={14} className="text-accent-gold" />
                  <span>Fokus: Römisches Reich</span>
                </div>
              </div>
              
              <button 
                onClick={() => navigate('/4')}
                className="w-full py-4 bg-ivory text-ink text-caption hover:bg-accent-gold transition-colors flex items-center justify-center gap-2"
              >
                <span>Training starten</span>
                <ArrowUpRight size={14} />
              </button>
            </div>
          </motion.div>
        </div>

        {/* === RECENT ACTIVITY SECTION === */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
          className="mt-12 pt-12 border-t border-ivory-muted"
        >
          <h3 className="font-display text-2xl font-medium mb-8">Letzte Aktivitäten</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { 
                action: 'Quiz abgeschlossen', 
                subject: 'Zellbiologie', 
                score: '85%', 
                time: 'Vor 2 Stunden',
                icon: Trophy
              },
              { 
                action: 'Notiz erstellt', 
                subject: 'Französische Revolution', 
                score: null, 
                time: 'Gestern',
                icon: BookOpen
              },
              { 
                action: 'Lernkarten wiederholt', 
                subject: 'Analysis', 
                score: '12 Karten', 
                time: 'Vor 3 Tagen',
                icon: Brain
              },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1 + i * 0.1 }}
                className="p-6 border border-ivory-muted hover:border-ink transition-all group cursor-pointer"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-10 h-10 border ${item.score ? 'border-accent-gold' : 'border-ivory-muted'} flex items-center justify-center group-hover:border-ink transition-colors`}>
                    <item.icon size={18} className={item.score ? 'text-accent-gold' : 'text-text-muted'} />
                  </div>
                  <span className="text-caption text-text-muted">{item.time}</span>
                </div>
                <p className="text-caption text-text-muted mb-1">{item.action}</p>
                <h4 className="font-body text-lg text-ink group-hover:text-accent-burnt transition-colors">
                  {item.subject}
                </h4>
                {item.score && (
                  <p className="text-caption text-accent-gold mt-2">{item.score}</p>
                )}
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
};
