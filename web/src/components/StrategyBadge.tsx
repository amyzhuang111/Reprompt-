const strategies: Record<string, { label: string; color: string }> = {
  specificity_injection: { label: "Specificity", color: "var(--color-strat-1)" },
  preference_framing: { label: "Preference", color: "var(--color-strat-2)" },
  problem_to_product: { label: "Problem→Product", color: "var(--color-strat-3)" },
  comparison_trigger: { label: "Comparison", color: "var(--color-strat-4)" },
  use_case_anchoring: { label: "Use-Case", color: "var(--color-strat-5)" },
  conciseness_optimization: { label: "Concise", color: "var(--color-strat-6)" },
  co_citation_targeting: { label: "Co-Citation", color: "var(--color-strat-7)" },
  turn1_opener: { label: "Turn 1 Opener", color: "var(--color-strat-8)" },
};

export default function StrategyBadge({ strategy }: { strategy: string }) {
  const s = strategies[strategy] ?? { label: strategy, color: "#666" };

  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{
        color: s.color,
        backgroundColor: `color-mix(in srgb, ${s.color} 12%, transparent)`,
        border: `1px solid color-mix(in srgb, ${s.color} 20%, transparent)`,
      }}
    >
      {s.label}
    </span>
  );
}
