import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, GraduationCap, TrendingUp, PenTool } from 'lucide-react';
import { motion } from 'framer-motion';
import logoSrc from '../Images/logo.png';

const SidebarItem = ({ to, icon: Icon, label }: { to: string; icon: any; label: string }) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      `group relative flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all duration-300 ${
        isActive
          ? 'text-gold'
          : 'text-text-secondary hover:text-text-primary'
      }`
    }
  >
    {({ isActive }) => (
      <>
        {/* Active gold indicator bar */}
        {isActive && (
          <motion.div
            layoutId="sidebar-active"
            className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-gold rounded-r-full"
            transition={{ type: 'spring', stiffness: 350, damping: 30 }}
          />
        )}
        <Icon size={18} strokeWidth={isActive ? 2.5 : 1.5} className="transition-all duration-300" />
        <span className={`text-sm tracking-wide ${isActive ? 'font-semibold' : 'font-normal'}`}>{label}</span>
        {/* Subtle hover glow */}
        <div className="absolute inset-0 rounded-xl bg-gold/0 group-hover:bg-gold/[0.03] transition-colors duration-300 pointer-events-none" />
      </>
    )}
  </NavLink>
);

export const Layout = () => {
  return (
    <div className="flex h-screen bg-void overflow-hidden font-sans grain">
      {/* Sidebar */}
      <motion.aside
        initial={{ x: -24, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-60 bg-deep/80 backdrop-blur-2xl border-r border-border-subtle flex flex-col justify-between relative"
      >
        {/* Decorative gradient at top */}
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-gold/[0.04] to-transparent pointer-events-none" />

        <div className="relative z-10">
          {/* Logo area */}
          <div className="px-6 pt-7 pb-10">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-gold/20 to-gold/5 border border-gold/20 flex items-center justify-center overflow-hidden">
                <img alt="Smartnotes" src={logoSrc} className="w-6 h-6 rounded" />
              </div>
              <div>
                <h1 className="text-lg font-serif text-text-primary tracking-tight leading-none">Smartnotes</h1>
                <span className="text-[9px] font-medium text-gold-muted uppercase tracking-[0.2em]">Library</span>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="px-3 space-y-1">
            <div className="px-4 mb-4">
              <span className="text-[9px] font-semibold text-text-ghost uppercase tracking-[0.2em]">Navigation</span>
            </div>
            <SidebarItem to="/1" icon={LayoutDashboard} label="Wissenswelt" />
            <SidebarItem to="/2" icon={PenTool} label="Flow-Modus" />
            <SidebarItem to="/4" icon={GraduationCap} label="Lern-Coach" />
            <SidebarItem to="/5" icon={TrendingUp} label="Fortschritt" />
          </nav>
        </div>

        {/* Bottom section */}
        <div className="px-6 pb-6 relative z-10">
          <div className="h-px bg-gradient-to-r from-transparent via-border-subtle to-transparent mb-5" />
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-elevated border border-border-subtle flex items-center justify-center">
              <span className="text-xs font-semibold text-gold">J</span>
            </div>
            <div>
              <p className="text-xs font-medium text-text-primary leading-none">Jakob</p>
              <p className="text-[10px] text-text-muted mt-0.5">12 Tage Streak</p>
            </div>
          </div>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative bg-void">
        <Outlet />
      </main>
    </div>
  );
};
