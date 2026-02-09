import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { LayoutDashboard, GraduationCap, TrendingUp, Feather, BookMarked, Menu } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';

const navItems = [
  { to: '/1', icon: LayoutDashboard, label: 'Wissen', index: '01' },
  { to: '/4', icon: GraduationCap, label: 'Coach', index: '02' },
  { to: '/5', icon: TrendingUp, label: 'Fortschritt', index: '03' },
];

export const Layout = () => {
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const currentPath = location.pathname;
  
  const getCurrentLabel = () => {
    const item = navItems.find(i => currentPath.includes(i.to.replace('/', '')));
    return item?.label || 'Wissen';
  };

  return (
    <div className="flex h-screen bg-ivory overflow-hidden font-body">
      {/* === ASYMMETRIC SIDEBAR === */}
      <motion.aside 
        initial={{ x: -100, opacity: 0 }}
        animate={{ 
          x: 0, 
          opacity: 1,
          width: isCollapsed ? 80 : 280
        }}
        transition={{ 
          x: { duration: 0.6, ease: [0.4, 0, 0.2, 1] },
          opacity: { duration: 0.6 },
          width: { duration: 0.4, ease: [0.4, 0, 0.2, 1] }
        }}
        className="bg-ink text-ivory flex flex-col relative z-50"
      >
        {/* Header / Logo Area */}
        <div className="p-8 border-b border-white/10">
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex items-center gap-4"
          >
            <div className="w-10 h-10 border border-accent-gold flex items-center justify-center flex-shrink-0">
              <Feather size={18} className="text-accent-gold" />
            </div>
            <AnimatePresence mode="wait">
              {!isCollapsed && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <h1 className="font-display text-xl font-semibold tracking-tight">Smartnotes</h1>
                  <p className="text-caption text-white/40">Wissen. Verstehen. Meistern.</p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-8 px-4">
          <div className="space-y-1">
            {navItems.map((item, index) => {
              const isActive = currentPath === item.to || currentPath === '/' && index === 0;
              
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `group flex items-center gap-4 px-4 py-4 transition-all duration-300 relative overflow-hidden ${
                      isActive 
                        ? 'text-ivory' 
                        : 'text-white/40 hover:text-white/80'
                    }`
                  }
                >
                  {/* Active Indicator */}
                  {isActive && (
                    <motion.div
                      layoutId="activeNav"
                      className="absolute left-0 top-0 bottom-0 w-0.5 bg-accent-gold"
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                  
                  {/* Index Number */}
                  <span className="font-mono text-xs text-white/30 w-6">{item.index}</span>
                  
                  {/* Icon */}
                  <item.icon size={18} className={`transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />
                  
                  {/* Label */}
                  <AnimatePresence mode="wait">
                    {!isCollapsed && (
                      <motion.span
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ duration: 0.2 }}
                        className="font-mono text-xs uppercase tracking-[0.15em]"
                      >
                        {item.label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                  
                  {/* Hover Line */}
                  {!isActive && !isCollapsed && (
                    <motion.div
                      initial={{ scaleX: 0 }}
                      whileHover={{ scaleX: 1 }}
                      className="absolute bottom-3 left-16 right-4 h-px bg-white/20 origin-left"
                    />
                  )}
                </NavLink>
              );
            })}
          </div>
        </nav>

        {/* Footer Section */}
        <div className="p-6 border-t border-white/10">
          <AnimatePresence mode="wait">
            {!isCollapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-3 text-white/30">
                  <BookMarked size={14} />
                  <span className="text-caption">42 Notizen</span>
                </div>
                <div className="h-px bg-white/10" />
                <div className="text-caption text-white/20">
                  {new Date().toLocaleDateString('de-DE', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          
          {/* Collapse Toggle */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="mt-4 w-full flex items-center justify-center py-3 text-white/30 hover:text-white/60 transition-colors"
          >
            <Menu size={18} className={`transition-transform duration-300 ${isCollapsed ? '' : 'rotate-180'}`} />
          </button>
        </div>
      </motion.aside>

      {/* === MAIN CONTENT AREA === */}
      <main className="flex-1 overflow-hidden relative">
        {/* Top Bar with Current Section */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="h-20 px-10 flex items-center justify-between border-b border-ivory-muted bg-ivory/80 backdrop-blur-md sticky top-0 z-40"
        >
          <div className="flex items-center gap-4">
            <span className="text-caption text-accent-slate">Aktuell</span>
            <div className="h-4 w-px bg-ivory-muted" />
            <h2 className="font-display text-lg font-medium">{getCurrentLabel()}</h2>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-caption text-text-muted">
              <div className="w-2 h-2 rounded-full bg-accent-forest animate-pulse" />
              <span>System aktiv</span>
            </div>
          </div>
        </motion.header>

        {/* Content Outlet */}
        <div className="h-[calc(100vh-5rem)] overflow-y-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
