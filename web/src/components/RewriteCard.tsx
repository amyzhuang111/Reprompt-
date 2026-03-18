import type { RewriteVariant } from "@/types/reprompt";
import ScoreRing from "./ScoreRing";
import StrategyBadge from "./StrategyBadge";
import ClusterTag from "./ClusterTag";
import Turn1Badge from "./Turn1Badge";
import CategoryTags from "./CategoryTags";

export default function RewriteCard({ variant, rank }: { variant: RewriteVariant; rank: number }) {
  return (
    <div className="group relative rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 transition-all duration-200 hover:border-[var(--color-border)]/80 hover:bg-[var(--color-bg-card-hover)]">
      <div className="flex items-start gap-4">
        {/* Rank */}
        <span className="mt-1 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-[11px] font-medium text-[var(--color-text-muted)]">
          {rank}
        </span>

        {/* Score */}
        <ScoreRing score={variant.score} size={48} strokeWidth={3.5} />

        {/* Content */}
        <div className="min-w-0 flex-1 space-y-2.5">
          {/* Query text */}
          <p className="text-[14px] leading-relaxed text-[var(--color-text-primary)]">
            {variant.query}
          </p>

          {/* Badges row */}
          <div className="flex flex-wrap items-center gap-1.5">
            <StrategyBadge strategy={variant.strategy} />
            <Turn1Badge optimized={variant.turn1_optimized} />
          </div>

          {/* Cluster + Categories */}
          <div className="space-y-1.5">
            <ClusterTag
              cluster={variant.citation_cluster}
              neighbors={variant.co_citation_neighbors}
            />
            <CategoryTags categories={variant.predicted_categories} />
          </div>

          {/* Score breakdown — visible on hover */}
          <div className="flex gap-3 pt-0.5 text-[10px] tabular-nums text-[var(--color-text-muted)] opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <span>LEX {variant.score_breakdown.lexical}</span>
            <span>STR {variant.score_breakdown.structural}</span>
            <span>SPC {variant.score_breakdown.specificity}</span>
            <span>SHP {variant.score_breakdown.shopping_proxy}</span>
            <span>CIT {variant.score_breakdown.citation_cluster}</span>
            <span>T1 {variant.score_breakdown.turn1_fitness}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
