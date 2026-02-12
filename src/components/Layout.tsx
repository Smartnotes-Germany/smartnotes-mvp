import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, GraduationCap, TrendingUp, PenTool, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { APP_ROUTES } from '../routes';

const SIDEBAR_COLLAPSE_KEY = 'smartnotes.sidebar.collapsed';

const sidebarItems = [
  { id: '01', to: APP_ROUTES.overview, icon: LayoutDashboard, label: 'Wissenswelt' },
  { id: '02', to: APP_ROUTES.flowMode, icon: PenTool, label: 'Flow-Modus' },
  { id: '03', to: APP_ROUTES.studyCoach, icon: GraduationCap, label: 'Lern-Coach' },
  { id: '04', to: APP_ROUTES.progress, icon: TrendingUp, label: 'Fortschritt' },
] as const;

const account = {
  name: 'Jakob S.',
  plan: 'Aktives Abo',
  avatarUrl:
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=240&q=80',
} as const;

const SidebarItem = ({
  id,
  to,
  icon: Icon,
  label,
  isCollapsed,
}: {
  id: string;
  to: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  isCollapsed: boolean;
}) => (
  <NavLink
    to={to}
    title={isCollapsed ? label : undefined}
    className={({ isActive }) =>
      `flex items-center py-3 transition-all duration-300 border-l-2 ${
        isCollapsed ? 'justify-center gap-2 px-2' : 'gap-3.5 px-5'
      } ${
        isActive
          ? 'border-accent text-ink bg-cream-dark/40'
          : 'border-transparent text-ink-secondary hover:text-ink hover:border-cream-dark hover:bg-cream-dark/20'
      }`
    }
  >
    <span className={`text-[0.625rem] font-medium tracking-[0.25em] text-ink-muted ${isCollapsed ? 'w-5 text-center' : ''}`}>
      {id}
    </span>
    <Icon size={16} />

    <AnimatePresence initial={false}>
      {!isCollapsed && (
        <motion.span
          key={label}
          initial={{ opacity: 0, x: -4 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -4 }}
          transition={{ duration: 0.15 }}
          className="text-[0.8125rem] font-medium tracking-wide"
        >
          {label}
        </motion.span>
      )}
    </AnimatePresence>
  </NavLink>
);

export const Layout = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    const storedState = window.localStorage.getItem(SIDEBAR_COLLAPSE_KEY);

    if (storedState !== null) {
      setIsCollapsed(storedState === 'true');
      return;
    }

    if (window.matchMedia('(max-width: 1024px)').matches) {
      setIsCollapsed(true);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_COLLAPSE_KEY, String(isCollapsed));
  }, [isCollapsed]);

  return (
    <div className="flex h-screen bg-cream overflow-hidden font-sans">
      {/* Sidebar */}
      <motion.aside
        initial={{ x: -10, opacity: 0 }}
        animate={{ x: 0, opacity: 1, width: isCollapsed ? 88 : 260 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="shrink-0 bg-cream-light border-r border-cream-border flex flex-col"
      >
        {/* Brand */}
        <div className={`${isCollapsed ? 'px-4' : 'px-7'} pt-8 pb-6`}>
          <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
            <div className="w-10 h-10 border border-cream-border bg-surface-white rounded-sm flex items-center justify-center">
              <PenTool size={14} className="text-accent" />
            </div>

            <AnimatePresence initial={false}>
              {!isCollapsed && (
                <motion.div
                  key="brand"
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -6 }}
                  transition={{ duration: 0.2 }}
                >
                  <h1 className="text-[0.8125rem] font-semibold tracking-[0.25em] uppercase text-ink">
                    Smartnotes
                  </h1>
                  <p className="text-[0.625rem] tracking-[0.2em] uppercase text-ink-muted mt-1">Wissen. Verstehen.</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Thin separator */}
        <div className={`${isCollapsed ? 'mx-3' : 'mx-6'} h-px bg-cream-border`} />

        {/* Navigation */}
        <nav className="mt-6 flex flex-col gap-0.5">
          {sidebarItems.map((item) => (
            <SidebarItem
              key={item.to}
              id={item.id}
              to={item.to}
              icon={item.icon}
              label={item.label}
              isCollapsed={isCollapsed}
            />
          ))}
        </nav>

        {/* Bottom section */}
        <div className={`${isCollapsed ? 'px-3 pb-5' : 'px-6 pb-8'} mt-auto`}>
          <div className="h-px bg-cream-border mb-6" />
          <AnimatePresence initial={false}>
            {!isCollapsed && (
              <motion.div
                key="account-card"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.2 }}
                className="mb-5"
              >
                <div className="flex items-center gap-3 rounded-2xl border border-cream-border bg-surface-white px-3 py-3 shadow-[0_6px_18px_rgba(30,24,18,0.08)]">
                  <div className="w-11 h-11 shrink-0 rounded-full overflow-hidden border border-cream-border bg-cream">
                    <img src={account.avatarUrl} alt={`${account.name} avatar`} className="w-full h-full object-cover" loading="lazy" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[0.9rem] font-semibold text-ink block leading-tight truncate">{account.name}</span>
                    <span className="text-[0.7rem] text-ink-muted tracking-wide">{account.plan}</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {isCollapsed && (
            <div className="flex justify-center mb-5">
              <div className="w-10 h-10 rounded-full overflow-hidden border border-cream-border bg-surface-white shadow-[0_4px_12px_rgba(30,24,18,0.08)]">
                <img src={account.avatarUrl} alt={`${account.name} avatar`} className="w-full h-full object-cover" loading="lazy" />
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsCollapsed((previous) => !previous)}
            aria-label={isCollapsed ? 'Sidebar ausklappen' : 'Sidebar einklappen'}
            className={`w-full h-10 rounded-md border border-cream-border bg-surface-white hover:bg-cream transition-colors flex items-center ${
              isCollapsed ? 'justify-center' : 'justify-start px-3 gap-2'
            } text-ink-secondary hover:text-ink`}
          >
            {isCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            {!isCollapsed && <span className="text-[0.6875rem] font-medium tracking-wide">Navigation</span>}
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative custom-scrollbar">
        <Outlet />
      </main>
    </div>
  );
};
