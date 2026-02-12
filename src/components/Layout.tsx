import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, GraduationCap, TrendingUp, PenTool, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { APP_ROUTES } from '../routes';

const SidebarItem = ({ to, icon: Icon, label }: { to: string; icon: React.ComponentType<{ size?: number; className?: string }>; label: string }) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      `flex items-center gap-3.5 px-5 py-3 transition-all duration-300 border-l-2 ${
        isActive
          ? 'border-accent text-ink bg-cream-dark/40'
          : 'border-transparent text-ink-secondary hover:text-ink hover:border-cream-dark hover:bg-cream-dark/20'
      }`
    }
  >
    <Icon size={16} />
    <span className="text-[0.8125rem] font-medium tracking-wide">{label}</span>
  </NavLink>
);

export const Layout = () => {
  return (
    <div className="flex h-screen bg-cream overflow-hidden font-sans">
      {/* Sidebar */}
      <motion.aside 
        initial={{ x: -10, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-[260px] bg-cream-light border-r border-cream-border flex flex-col"
      >
        {/* Brand */}
        <div className="px-7 pt-8 pb-6">
          <div className="flex items-center gap-2.5">
            <h1 className="text-[0.8125rem] font-semibold tracking-[0.25em] uppercase text-ink">
              Smartnotes
            </h1>
            <span className="text-accent text-lg leading-none font-serif font-bold">.</span>
          </div>
        </div>

        {/* Thin separator */}
        <div className="mx-6 h-px bg-cream-border" />

        {/* Navigation */}
        <nav className="mt-6 flex flex-col gap-0.5">
          <SidebarItem to={APP_ROUTES.overview} icon={LayoutDashboard} label="Wissenswelt" />
          <SidebarItem to={APP_ROUTES.flowMode} icon={PenTool} label="Flow-Modus" />
          <SidebarItem to={APP_ROUTES.studyCoach} icon={GraduationCap} label="Lern-Coach" />
          <SidebarItem to={APP_ROUTES.progress} icon={TrendingUp} label="Fortschritt" />
        </nav>

        {/* Bottom section */}
        <div className="mt-auto px-6 pb-8">
          <div className="h-px bg-cream-border mb-6" />
          <div className="flex items-center gap-2.5 px-1">
            <div className="w-7 h-7 rounded-full bg-ink flex items-center justify-center">
              <Sparkles size={12} className="text-cream" />
            </div>
            <div>
              <span className="text-[0.6875rem] font-semibold text-ink block leading-tight">Smartnotes Pro</span>
              <span className="text-[0.625rem] text-ink-muted">Beta-Zugang</span>
            </div>
          </div>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative custom-scrollbar">
        <Outlet />
      </main>
    </div>
  );
};
