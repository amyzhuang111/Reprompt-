const clusterLabels: Record<string, string> = {
  personal_finance: "Finance",
  tech_electronics: "Tech",
  health_wellness: "Health",
  home_lifestyle: "Home",
  travel: "Travel",
};

interface ClusterTagProps {
  cluster: string;
  neighbors: string[];
}

export default function ClusterTag({ cluster, neighbors }: ClusterTagProps) {
  if (!cluster) return null;

  const label = clusterLabels[cluster] ?? cluster;

  return (
    <div className="flex items-center gap-2">
      <span className="inline-flex items-center gap-1 text-[11px] text-[var(--color-text-muted)]">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20M2 12h20" />
        </svg>
        {label}
      </span>
      {neighbors.slice(0, 3).map((d) => (
        <span
          key={d}
          className="rounded bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-[var(--color-text-muted)]"
        >
          {d}
        </span>
      ))}
    </div>
  );
}
