import { motion } from 'framer-motion';
import { Trophy, TrendingUp, Target, Clock, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Explicit class map so Tailwind can detect them at build time
const accentStyles: Record<string, { bg: string; text: string; bar: string }> = {
  gold:     { bg: 'bg-gold/10',     text: 'text-gold',     bar: 'bg-gold' },
  teal:     { bg: 'bg-teal/10',     text: 'text-teal',     bar: 'bg-teal' },
  amethyst: { bg: 'bg-amethyst/10', text: 'text-amethyst', bar: 'bg-amethyst' },
  sky:      { bg: 'bg-sky/10',      text: 'text-sky',      bar: 'bg-sky' },
  amber:    { bg: 'bg-amber/10',    text: 'text-amber',    bar: 'bg-amber' },
  coral:    { bg: 'bg-coral/10',    text: 'text-coral',    bar: 'bg-coral' },
};

const StatCard = ({
  icon: Icon,
  label,
  value,
  accent,
  delay,
}: {
  icon: any;
  label: string;
  value: string;
  accent: string;
  delay: number;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    className="bg-surface border border-border-subtle rounded-2xl p-6 flex items-start justify-between group hover:border-border-strong transition-all"
  >
    <div>
      <span className="text-text-muted text-sm font-medium block mb-1.5">{label}</span>
      <span className="text-2xl font-bold text-text-primary">{value}</span>
    </div>
    <div className={`p-3 rounded-xl ${accentStyles[accent].bg} ${accentStyles[accent].text}`}>
      <Icon size={22} />
    </div>
  </motion.div>
);

export const Progress = () => {
  const navigate = useNavigate();

  const subjects = [
    { subject: 'Biologie: Genetik', progress: 92, color: 'teal' },
    { subject: 'Mathe: Analysis', progress: 65, color: 'amber' },
    { subject: 'Geschichte: Antike', progress: 45, color: 'coral' },
    { subject: 'Englisch: Grammatik', progress: 88, color: 'teal' },
  ];

  return (
    <div className="h-full bg-void p-10 overflow-y-auto">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-10"
        >
          <h2 className="text-3xl font-serif text-text-primary mb-2">Dein Lernfortschritt</h2>
          <p className="text-text-muted">Du entwickelst dich gro\u00dfartig! Hier ist deine Wochen\u00fcbersicht.</p>
        </motion.div>

        {/* Stat Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
          <StatCard icon={Trophy} label="Lernerfolg" value="78%" accent="gold" delay={0.1} />
          <StatCard icon={TrendingUp} label="Lernstreak" value="12 Tage" accent="teal" delay={0.15} />
          <StatCard icon={Target} label="Fokus-Themen" value="4 Aktiv" accent="amethyst" delay={0.2} />
          <StatCard icon={Clock} label="Lernzeit" value="14.5 Std" accent="sky" delay={0.25} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Chart Area */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.4 }}
            className="lg:col-span-2 bg-surface rounded-2xl border border-border-subtle p-8"
          >
            <h3 className="font-semibold text-lg text-text-primary mb-8">Wissensl\u00fccken Analyse</h3>

            <div className="space-y-7">
              {subjects.map((item, i) => (
                <div key={item.subject}>
                  <div className="flex justify-between text-sm font-medium mb-2.5">
                    <span className="text-text-secondary">{item.subject}</span>
                    <span className="text-text-muted tabular-nums">{item.progress}%</span>
                  </div>
                  <div className="h-2 bg-elevated rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${item.progress}%` }}
                      transition={{ delay: 0.5 + i * 0.12, duration: 1.2, ease: 'easeOut' }}
                      className={`h-full ${accentStyles[item.color].bar} rounded-full`}
                    />
                  </div>
                  {item.progress < 50 && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 1 + i * 0.1 }}
                      className="text-xs text-coral mt-1.5 flex items-center gap-1.5 cursor-pointer hover:text-coral-muted transition-colors group"
                      onClick={() => navigate('/4')}
                    >
                      <Target size={12} /> <span className="group-hover:underline">Fokus empfohlen</span>
                    </motion.p>
                  )}
                </div>
              ))}
            </div>
          </motion.div>

          {/* AI Coach Card */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.4 }}
            className="bg-surface rounded-2xl border border-border-subtle p-8 flex flex-col justify-between relative overflow-hidden"
          >
            {/* Decorative gradient */}
            <div className="absolute -top-16 -right-16 w-48 h-48 bg-gold/[0.06] rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-5">
                <Sparkles size={18} className="text-gold" />
                <span className="text-xs font-bold text-gold uppercase tracking-wider">Smart Coach</span>
              </div>
              <h3 className="text-2xl font-serif text-text-primary mb-4 leading-tight">
                "Du hast Probleme mit der Antike?"
              </h3>
              <p className="text-text-muted leading-relaxed text-sm">
                Ich habe bemerkt, dass du bei den Quizfragen zum R\u00f6mischen Reich oft z\u00f6gerst. Ich habe dir ein spezielles 5-Minuten-Training
                zusammengestellt.
              </p>
            </div>

            <button
              onClick={() => navigate('/4')}
              className="relative z-10 w-full py-3.5 bg-gold text-void rounded-xl font-bold mt-8 hover:bg-gold-light transition-colors glow-gold"
            >
              Training starten
            </button>
          </motion.div>
        </div>
      </div>
    </div>
  );
};
