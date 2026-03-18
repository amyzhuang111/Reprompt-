import type { BasketResult } from "@/types/reprompt";
import ScoreRing from "./ScoreRing";

export default function BasketResults({ data }: { data: BasketResult }) {
  return (
    <div className="space-y-6">
      {/* Aggregate stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Prompts" value={data.prompt_count.toString()} />
        <Stat label="Avg Original" value={data.avg_original_score.toFixed(1)} color="var(--color-score-low)" />
        <Stat label="Avg Best Rewrite" value={data.avg_best_rewrite_score.toFixed(1)} color="var(--color-score-high)" />
        <Stat label="Avg Lift" value={`+${data.avg_lift.toFixed(1)}`} color="var(--color-lift)" />
      </div>

      {/* Results table */}
      <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
              <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-widest text-[var(--color-text-muted)]">Original</th>
              <th className="w-16 px-3 py-3 text-center text-[11px] font-medium uppercase tracking-widest text-[var(--color-text-muted)]">Score</th>
              <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-widest text-[var(--color-text-muted)]">Best Rewrite</th>
              <th className="w-16 px-3 py-3 text-center text-[11px] font-medium uppercase tracking-widest text-[var(--color-text-muted)]">Score</th>
              <th className="w-16 px-3 py-3 text-center text-[11px] font-medium uppercase tracking-widest text-[var(--color-text-muted)]">Lift</th>
            </tr>
          </thead>
          <tbody>
            {data.results.map((r, i) => {
              const best = r.rewrites[0];
              const lift = best ? best.score - r.original_score : 0;
              return (
                <tr
                  key={i}
                  className="border-b border-[var(--color-border)]/50 last:border-0 transition-colors hover:bg-[var(--color-bg-card)]"
                >
                  <td className="max-w-[220px] truncate px-4 py-3 text-[var(--color-text-secondary)]">
                    {r.original_query}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <div className="flex justify-center">
                      <ScoreRing score={r.original_score} size={32} strokeWidth={2.5} />
                    </div>
                  </td>
                  <td className="max-w-[220px] truncate px-4 py-3 text-[var(--color-text-primary)]">
                    {best?.query ?? "—"}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <div className="flex justify-center">
                      {best && <ScoreRing score={best.score} size={32} strokeWidth={2.5} />}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span
                      className="text-[13px] font-semibold tabular-nums"
                      style={{ color: lift > 0 ? "var(--color-lift)" : "var(--color-text-muted)" }}
                    >
                      {lift > 0 ? "+" : ""}{lift}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
      <p className="text-[10px] font-medium uppercase tracking-widest text-[var(--color-text-muted)]">
        {label}
      </p>
      <p
        className="mt-1.5 text-2xl font-bold tabular-nums tracking-tight"
        style={{ color: color ?? "var(--color-text-primary)" }}
      >
        {value}
      </p>
    </div>
  );
}
