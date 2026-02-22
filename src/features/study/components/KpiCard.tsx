type KpiCardProps = {
  label: string;
  value: string;
};

export function KpiCard({ label, value }: KpiCardProps) {
  return (
    <div className="border-cream-border bg-surface-white rounded-[1.5rem] border p-5 shadow-sm transition duration-300 hover:scale-[1.02] md:rounded-[2rem] md:p-8">
      <p className="text-accent mb-2 text-[9px] font-bold tracking-[0.2em] uppercase md:text-[10px]">
        {label}
      </p>
      <p className="text-ink text-lg font-black tracking-tight md:text-2xl">
        {value}
      </p>
    </div>
  );
}
