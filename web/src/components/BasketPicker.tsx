"use client";

interface BasketPickerProps {
  baskets: string[];
  selected: string | null;
  onSelect: (name: string) => void;
  loading: boolean;
}

const basketMeta: Record<string, { label: string; count: number; rate: string }> = {
  health: { label: "Health & Wellness", count: 30, rate: "47%" },
  productivity: { label: "Productivity", count: 25, rate: "42%" },
  sleep: { label: "Sleep", count: 25, rate: "41%" },
  electronics: { label: "Electronics", count: 30, rate: "high" },
  home: { label: "Home & Furniture", count: 25, rate: "est." },
};

export default function BasketPicker({ baskets, selected, onSelect, loading }: BasketPickerProps) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {baskets.map((name) => {
        const meta = basketMeta[name] ?? { label: name, count: 0, rate: "—" };
        const isActive = selected === name;

        return (
          <button
            key={name}
            onClick={() => onSelect(name)}
            disabled={loading}
            className={`group rounded-lg border p-3 text-left transition-all duration-200 ${
              isActive
                ? "border-[var(--color-accent)]/40 bg-[var(--color-accent-glow)]"
                : "border-[var(--color-border)] bg-[var(--color-bg-card)] hover:border-[var(--color-text-muted)]/30 hover:bg-[var(--color-bg-card-hover)]"
            } disabled:opacity-40`}
          >
            <p className={`text-[13px] font-medium ${isActive ? "text-[var(--color-accent-bright)]" : "text-[var(--color-text-primary)]"}`}>
              {meta.label}
            </p>
            <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">
              {meta.count} prompts · {meta.rate} rec rate
            </p>
          </button>
        );
      })}
    </div>
  );
}
