import { Bell, Palette, Shield, UserCircle2 } from 'lucide-react';

const settingsGroups = [
  {
    title: 'Konto',
    description: 'Persoenliche Daten und Sichtbarkeit verwalten',
    icon: UserCircle2,
  },
  {
    title: 'Benachrichtigungen',
    description: 'E-Mail-Updates und Lern-Erinnerungen anpassen',
    icon: Bell,
  },
  {
    title: 'Darstellung',
    description: 'Farbthema und Lesekomfort konfigurieren',
    icon: Palette,
  },
  {
    title: 'Datenschutz',
    description: 'Sicherheit und Datenfreigabe kontrollieren',
    icon: Shield,
  },
] as const;

export const Settings = () => {
  return (
    <div className="h-full bg-cream overflow-y-auto custom-scrollbar">
      <div className="mx-auto w-full max-w-5xl px-6 py-10 md:px-10 md:py-12">
        <header className="mb-10">
          <span className="section-label">System</span>
          <h1 className="editorial-heading mt-4 text-[2.2rem] leading-tight text-ink">Einstellungen</h1>
          <p className="mt-3 max-w-2xl text-[0.9rem] leading-relaxed text-ink-muted">
            Passe Smartnotes an deinen Lernstil an. Diese Bereiche steuern dein Konto, Benachrichtigungen und
            Sicherheit.
          </p>
        </header>

        <div className="grid gap-4 md:grid-cols-2">
          {settingsGroups.map((group) => {
            const Icon = group.icon;

            return (
              <button
                key={group.title}
                type="button"
                className="group rounded-sm border border-cream-border bg-surface-white p-5 text-left transition-colors hover:border-accent/60 hover:bg-cream-light"
              >
                <div className="flex items-start gap-4">
                  <div className="mt-0.5 rounded-sm border border-cream-border bg-cream p-2 text-ink-muted transition-colors group-hover:text-accent">
                    <Icon size={16} />
                  </div>
                  <div>
                    <h2 className="text-[0.95rem] font-semibold text-ink">{group.title}</h2>
                    <p className="mt-1 text-[0.8rem] leading-relaxed text-ink-muted">{group.description}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
