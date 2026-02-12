import { motion } from 'framer-motion';
import { Trophy, TrendingUp, Target, Clock, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { APP_ROUTES } from '../routes';

const StatCard = ({ icon: Icon, label, value }: { icon: React.ComponentType<{ size?: number; className?: string }>; label: string; value: string }) => (
  <div className="bg-surface-white border border-cream-border rounded-sm p-6 flex items-start justify-between group hover:border-ink-muted transition-colors">
    <div>
      <span className="text-[0.75rem] font-medium text-ink-muted block mb-2">{label}</span>
      <span className="text-[1.5rem] font-serif font-bold text-ink tracking-tight">{value}</span>
    </div>
    <div className="p-2.5 border border-cream-border rounded-sm text-ink-muted group-hover:text-accent group-hover:border-accent/30 transition-colors">
      <Icon size={18} />
    </div>
  </div>
);

export const Progress = () => {
  const navigate = useNavigate();

  return (
    <div className="h-full bg-cream p-10 overflow-y-auto custom-scrollbar">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-10">
          <div className="section-label mb-4">Fortschritt</div>
          <h2 className="editorial-heading text-[2rem] mb-2">Dein Lernfortschritt</h2>
          <p className="text-[0.875rem] text-ink-muted font-medium">Du entwickelst dich großartig. Hier ist deine Wochenübersicht.</p>
        </div>

        {/* Thin separator */}
        <div className="h-px bg-cream-border mb-10" />

        {/* Stat Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
          <StatCard icon={Trophy} label="Lernerfolg" value="78%" />
          <StatCard icon={TrendingUp} label="Lernstreak" value="12 Tage" />
          <StatCard icon={Target} label="Fokus-Themen" value="4 Aktiv" />
          <StatCard icon={Clock} label="Lernzeit" value="14.5 Std" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Chart Area */}
          <div className="lg:col-span-2 bg-surface-white border border-cream-border rounded-sm p-8">
            <div className="flex items-center justify-between mb-8">
              <h3 className="font-serif font-bold text-[1.125rem] text-ink">Wissenslücken Analyse</h3>
              <span className="section-label text-[0.5625rem]">Aktuell</span>
            </div>
            
            <div className="space-y-7">
              {[
                { subject: "Biologie: Genetik", progress: 92, status: "stark" },
                { subject: "Mathe: Analysis", progress: 65, status: "mittel" },
                { subject: "Geschichte: Antike", progress: 45, status: "schwach" },
                { subject: "Englisch: Grammatik", progress: 88, status: "stark" },
              ].map((item, i) => (
                <div key={item.subject}>
                  <div className="flex justify-between text-[0.8125rem] mb-2.5">
                    <span className="font-medium text-ink">{item.subject}</span>
                    <span className="text-ink-muted font-medium">{item.progress}%</span>
                  </div>
                  <div className="h-[3px] bg-cream-dark rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${item.progress}%` }}
                      transition={{ delay: 0.3 + i * 0.12, duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
                      className={`h-full rounded-full ${
                        item.progress >= 80 ? 'bg-accent' : item.progress >= 60 ? 'bg-[#8b6914]' : 'bg-[#c2746b]'
                      }`}
                    />
                  </div>
                  {item.progress < 50 && (
                    <p 
                      className="text-[0.6875rem] text-[#c2746b] mt-1.5 flex items-center gap-1.5 cursor-pointer hover:underline font-medium"
                      onClick={() => navigate(APP_ROUTES.studyCoach)}
                    >
                      <Target size={11} /> Fokus empfohlen
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* AI Coach Suggestion */}
          <div className="bg-ink rounded-sm p-8 text-cream flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-5">
                <Sparkles size={14} className="text-accent" />
                <span className="text-[0.6875rem] font-semibold text-cream/60 tracking-[0.2em] uppercase">Smart Coach</span>
              </div>
              <h3 className="text-[1.5rem] font-serif font-bold mb-4 leading-[1.25] italic">
                "Du hast Probleme mit der Antike?"
              </h3>
              <p className="text-cream/60 leading-[1.7] text-[0.8125rem]">
                Ich habe bemerkt, dass du bei den Quizfragen zum Römischen Reich oft zögerst. Ich habe dir ein spezielles 5-Minuten-Training zusammengestellt.
              </p>
            </div>
            
            <button 
              onClick={() => navigate(APP_ROUTES.studyCoach)}
              className="w-full py-3 bg-cream text-ink rounded-sm font-semibold text-[0.8125rem] mt-8 hover:bg-cream-light transition-colors tracking-wide"
            >
              Training starten
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
