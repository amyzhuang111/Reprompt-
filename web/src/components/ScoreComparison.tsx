import ScoreRing from "./ScoreRing";

interface ScoreComparisonProps {
  originalScore: number;
  bestScore: number;
  originalQuery: string;
  bestQuery: string;
}

export default function ScoreComparison({
  originalScore,
  bestScore,
  originalQuery,
  bestQuery,
}: ScoreComparisonProps) {
  const delta = bestScore - originalScore;

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)]">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 p-6">
        {/* Original */}
        <div className="flex items-center gap-4">
          <ScoreRing score={originalScore} size={64} label="Original" />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
              &ldquo;{originalQuery}&rdquo;
            </p>
          </div>
        </div>

        {/* Delta */}
        <div className="flex flex-col items-center gap-1 px-4">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-[var(--color-text-muted)]">
            <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span
            className="text-lg font-bold tabular-nums"
            style={{ color: delta > 0 ? "var(--color-lift)" : "var(--color-text-muted)" }}
          >
            {delta > 0 ? "+" : ""}{delta}
          </span>
          <span className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">lift</span>
        </div>

        {/* Best */}
        <div className="flex items-center gap-4">
          <ScoreRing score={bestScore} size={64} label="Best" />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium leading-relaxed text-[var(--color-text-primary)]">
              &ldquo;{bestQuery}&rdquo;
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
