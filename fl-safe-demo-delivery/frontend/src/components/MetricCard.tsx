interface MetricCardProps {
  label: string;
  value: string;
  accent?: "cyan" | "green" | "amber" | "red";
  hint?: string;
}

export function MetricCard({ label, value, accent = "cyan", hint }: MetricCardProps) {
  return (
    <div className={`metric-card accent-${accent}`}>
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      {hint ? <div className="metric-hint">{hint}</div> : null}
    </div>
  );
}
