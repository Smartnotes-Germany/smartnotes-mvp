import { NavLink, Outlet } from 'react-router-dom';
import {LayoutDashboard, PenTool, Network, GraduationCap, TrendingUp, Zap} from 'lucide-react';
import { motion } from 'framer-motion';

const SidebarItem = ({ to, icon: Icon, label }: { to: string; icon: any; label: string }) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${
        isActive
          ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/30'
          : 'text-brand-secondary hover:bg-white hover:text-brand-dark'
      }`
    }
  >
    <Icon size={20} />
    <span className="font-medium">{label}</span>
  </NavLink>
);

export const Layout = () => {
  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      {/* Sidebar */}
      <motion.aside 
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        className="w-64 bg-slate-100/50 backdrop-blur-xl border-r border-slate-200 p-6 flex flex-col justify-between"
      >
        <div>
          <div className="flex items-center gap-2 mb-10 px-2 text-brand-dark">
              <img alt="Smartnotes" src={"src/Images/logo.png"} className="rounded-lg" width={35} height={35}/>
            <h1 className="text-xl font-bold font-serif tracking-tight">Smartnotes</h1>
          </div>

          <nav className="space-y-2">
            <SidebarItem to="/1" icon={LayoutDashboard} label="Wissenwelt" />
            <SidebarItem to="/4" icon={GraduationCap} label="Lern-Coach" />
            <SidebarItem to="/5" icon={TrendingUp} label="Fortschritt" />
          </nav>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative">
        <Outlet />
      </main>
    </div>
  );
};
