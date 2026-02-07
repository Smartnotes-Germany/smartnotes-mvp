import React from 'react';
import { motion } from 'framer-motion';
import { Trophy, TrendingUp, Target, Clock, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const StatCard = ({ icon: Icon, label, value, color }: any) => (
  <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-start justify-between">
    <div>
      <span className="text-slate-500 text-sm font-medium block mb-1">{label}</span>
      <span className="text-2xl font-bold text-slate-900">{value}</span>
    </div>
    <div className={`p-3 rounded-xl ${color} bg-opacity-10 text-white text-opacity-100`}>
      <Icon size={24} className={color.replace('bg-')} />
    </div>
  </div>
);

export const Progress = () => {
  const navigate = useNavigate();

  return (
    <div className="h-full bg-slate-50 p-10 overflow-y-auto">
      <div className="max-w-5xl mx-auto">
        <div className="mb-10">
          <h2 className="text-3xl font-serif font-bold text-slate-900 mb-2">Dein Lernfortschritt</h2>
          <p className="text-slate-500">Du entwickelst dich großartig! Hier ist deine Wochenübersicht.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          <StatCard icon={Trophy} label="Lernerfolg" value="78%" color="bg-brand-dark" />
          <StatCard icon={TrendingUp} label="Lernstreak" value="12 Tage" color="bg-brand-dark" />
          <StatCard icon={Target} label="Fokus-Themen" value="4 Aktiv" color="bg-brand-dark" />
          <StatCard icon={Clock} label="Lernzeit" value="14.5 Std" color="bg-brand-dark" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Chart Area (Visualized as Skills) */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
            <h3 className="font-bold text-lg mb-6">Wissenslücken Analyse</h3>
            
            <div className="space-y-6">
              {[
                { subject: "Biologie: Genetik", progress: 92, color: "bg-emerald-500" },
                { subject: "Mathe: Analysis", progress: 65, color: "bg-amber-500" },
                { subject: "Geschichte: Antike", progress: 45, color: "bg-red-500" },
                { subject: "Englisch: Grammatik", progress: 88, color: "bg-emerald-500" },
              ].map((item, i) => (
                <div key={item.subject}>
                  <div className="flex justify-between text-sm font-medium mb-2">
                    <span>{item.subject}</span>
                    <span className="text-slate-500">{item.progress}%</span>
                  </div>
                  <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${item.progress}%` }}
                      transition={{ delay: 0.5 + i * 0.1, duration: 1.5, ease: "easeOut" }}
                      className={`h-full ${item.color} rounded-full`}
                    />
                  </div>
                  {item.progress < 50 && (
                    <p 
                      className="text-xs text-red-500 mt-1 flex items-center gap-1 cursor-pointer hover:underline"
                      onClick={() => navigate('/3')}
                    >
                      <Target size={12} /> Fokus empfohlen
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* AI Coach Suggestion */}
          <div className="bg-gradient-to-b from-brand-primary to-brand-primary rounded-2xl p-8 text-white flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-4 opacity-80">
                <Sparkles size={20} />
                <span className="text-sm font-bold uppercase tracking-wider">Smart Coach</span>
              </div>
              <h3 className="text-2xl font-serif font-bold mb-4 leading-tight">
                "Du hast Probleme mit der Antike?"
              </h3>
              <p className="text-indigo-100 opacity-90 leading-relaxed text-sm">
                Ich habe bemerkt, dass du bei den Quizfragen zum Römischen Reich oft zögerst. Ich habe dir ein spezielles 5-Minuten-Training zusammengestellt.
              </p>
            </div>
            
            <button 
              onClick={() => navigate('/4')}
              className="w-full py-3 bg-white text-brand-dark rounded-xl font-bold mt-8 hover:bg-indigo-50 transition-colors shadow-lg"
            >
              Training starten
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
