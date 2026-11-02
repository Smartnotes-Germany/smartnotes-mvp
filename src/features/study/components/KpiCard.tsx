type KpiCardProps = {
  label: string;
  value: string;
};

export function KpiCard({ label, value }: KpiCardProps) {
  return (
    <div className="sp-card min-w-0 p-5 md:p-8">
      <p className="text-ink-secondary mb-2 text-sm font-medium">{label}</p>
      <p className="text-ink max-w-full text-xl leading-tight font-medium tracking-[-0.04em] [overflow-wrap:anywhere] md:text-2xl">
        {value}
      </p>
    </div>
  );
}
