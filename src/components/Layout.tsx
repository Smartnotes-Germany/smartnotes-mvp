import { NavLink, Outlet } from "react-router-dom";
import { LayoutDashboard, GraduationCap, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";
import type { ComponentType } from "react";
import logo from "../Images/logo.png";

const navItems = [
  { to: "/1", icon: LayoutDashboard, label: "Wissenwelt", index: "01" },
  { to: "/4", icon: GraduationCap, label: "Lern-Coach", index: "02" },
  { to: "/5", icon: TrendingUp, label: "Fortschritt", index: "03" },
];

const SidebarItem = ({
  to,
  icon: Icon,
  label,
  index,
}: {
  to: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  label: string;
  index: string;
}) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      `group relative flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 transition-all duration-300 ${
        isActive
          ? "border-brand-primary bg-brand-primary text-white shadow-[0_14px_32px_-18px_rgba(29,78,234,0.75)]"
          : "border-white/70 bg-white/50 text-brand-secondary hover:border-brand-primary/35 hover:bg-white/75 hover:text-brand-dark"
      }`
    }
  >
    <span className="flex items-center gap-3">
      <Icon size={18} className="shrink-0" />
      <span className="font-semibold tracking-wide">{label}</span>
    </span>
    <span className="font-mono text-[0.62rem] tracking-[0.22em] opacity-55">{index}</span>
  </NavLink>
);

export const Layout = () => {
  return (
    <div className="neo-shell relative flex h-screen overflow-hidden p-3 md:p-5">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-16 top-18 h-56 w-56 rounded-full bg-brand-primary/15 blur-3xl" />
        <div className="absolute right-0 top-1/3 h-72 w-72 rounded-full bg-brand-accent/20 blur-3xl" />
      </div>

      <motion.aside
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        className="neo-panel relative z-10 flex w-72 shrink-0 flex-col justify-between rounded-[2rem] p-6"
      >
        <div>
          <div className="mb-10 rounded-2xl border border-white/70 bg-white/50 px-4 py-3">
            <div className="flex items-center gap-3 text-brand-dark">
              <img alt="Smartnotes" src={logo} className="rounded-xl" width={40} height={40} />
              <div>
                <h1 className="font-serif text-xl font-bold tracking-tight">Smartnotes</h1>
                <p className="font-mono text-[0.62rem] uppercase tracking-[0.25em] text-brand-secondary">
                  Studio
                </p>
              </div>
            </div>
          </div>

          <nav className="space-y-2">
            {navItems.map((item) => (
              <SidebarItem
                key={item.to}
                to={item.to}
                icon={item.icon}
                label={item.label}
                index={item.index}
              />
            ))}
          </nav>
        </div>

        <div className="rounded-2xl border border-white/65 bg-white/55 px-4 py-4">
          <p className="font-mono text-[0.64rem] uppercase tracking-[0.18em] text-brand-secondary">
            Daily Pulse
          </p>
          <p className="mt-2 text-sm font-semibold text-brand-dark">12 Tage Lernstreak. Momentum bleibt stark.</p>
        </div>
      </motion.aside>

      <main className="relative z-10 flex-1 overflow-y-auto pl-0 pt-3 md:pl-4 md:pt-0">
        <section className="neo-panel h-full overflow-hidden rounded-[2rem]">
          <Outlet />
        </section>
      </main>
    </div>
  );
};
