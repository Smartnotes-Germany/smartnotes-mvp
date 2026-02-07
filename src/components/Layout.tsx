import { NavLink, Outlet } from 'react-router-dom';
import {LayoutDashboard, GraduationCap, TrendingUp} from 'lucide-react';
import { motion } from 'framer-motion';

const SidebarItem = ({ to, icon: Icon, label }: { to: string; icon: any; label: string }) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group ${
        isActive
          ? 'text-brand-primary font-bold bg-white shadow-sm border border-slate-200'
          : 'text-slate-500 hover:text-brand-dark hover:bg-slate-100/50'
      }`
    }
  >
    {({ isActive }) => (
      <>
        <Icon size={18} strokeWidth={isActive ? 2.5 : 2} className="transition-transform group-hover:scale-110" />
        <span className="text-sm tracking-wide">{label}</span>
      </>
    )}
  </NavLink>
);

export const Layout = () => {
  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden selection:bg-brand-secondary/30 selection:text-brand-dark">
      {/* Sidebar */}
      <motion.aside 
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        className="w-72 bg-slate-50 border-r border-slate-200 p-8 flex flex-col justify-between"
      >
        <div>
          <div className="flex items-center gap-3 mb-12 px-2">
            <div className="w-8 h-8 rounded-full bg-brand-primary flex items-center justify-center text-white font-serif font-bold text-lg">S</div>
            <h1 className="text-2xl font-serif font-bold tracking-tight text-brand-dark">Smartnotes</h1>
          </div>

          <nav className="space-y-2">
            <SidebarItem to="/1" icon={LayoutDashboard} label="Wissenswelt" />
            <SidebarItem to="/4" icon={GraduationCap} label="Lern-Coach" />
            <SidebarItem to="/5" icon={TrendingUp} label="Fortschritt" />
          </nav>
        </div>
        
        <div className="px-4 py-4 rounded-xl bg-white border border-slate-200 shadow-sm">
             <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200" />
                <div>
                   <p className="text-xs font-bold text-brand-dark">Jakob S.</p>
                   <p className="text-[10px] text-slate-400">Pro Plan</p>
                </div>
             </div>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative bg-white/50">
        <Outlet />
      </main>
    </div>
  );
};
