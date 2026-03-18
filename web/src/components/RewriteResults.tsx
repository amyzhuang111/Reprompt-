import type { RewriteResponse } from "@/types/reprompt";
import ScoreComparison from "./ScoreComparison";
import RewriteCard from "./RewriteCard";

export default function RewriteResults({ data }: { data: RewriteResponse }) {
  const best = data.rewrites[0];

  return (
    <div className="space-y-6">
      {best && (
        <ScoreComparison
          originalScore={data.original_score}
          bestScore={best.score}
          originalQuery={data.original_query}
          bestQuery={best.query}
        />
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-[12px] font-medium uppercase tracking-widest text-[var(--color-text-muted)]">
            All Rewrites
          </h2>
          <span className="text-[12px] tabular-nums text-[var(--color-text-muted)]">
            {data.rewrites.length} variants
          </span>
        </div>
        <div className="space-y-2">
          {data.rewrites.map((v, i) => (
            <RewriteCard key={i} variant={v} rank={i + 1} />
          ))}
        </div>
      </div>

      {data.metadata.processing_time_ms && (
        <p className="text-[11px] text-[var(--color-text-muted)]">
          {data.metadata.processing_time_ms}ms
          {data.metadata.model_version && data.metadata.model_version !== "mock"
            ? ` · ${data.metadata.model_version}`
            : " · mock mode"}
        </p>
      )}
    </div>
  );
}
