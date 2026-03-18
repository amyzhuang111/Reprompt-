export default function Turn1Badge({ optimized }: { optimized: boolean }) {
  if (!optimized) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-score-high)]/20 bg-[var(--color-score-high)]/[0.08] px-2 py-0.5 text-[11px] font-medium text-[var(--color-score-high)]">
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-score-high)]" />
      Turn 1
    </span>
  );
}
