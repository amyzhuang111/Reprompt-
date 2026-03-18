"use client";

import { useState, useEffect } from "react";
import type { BasketResult } from "@/types/reprompt";
import { getBaskets, runBasket } from "@/lib/api";
import BasketPicker from "@/components/BasketPicker";
import BasketResults from "@/components/BasketResults";

export default function BasketsPage() {
  const [baskets, setBaskets] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BasketResult | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getBaskets().then(setBaskets).catch(() => setBaskets([]));
  }, []);

  const handleRun = async (name: string) => {
    setSelected(name);
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const data = await runBasket(name);
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to run basket");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-10">
      <div className="glow-blue pt-4 text-center">
        <h1 className="text-[28px] font-semibold tracking-tight text-[var(--color-text-primary)]">
          Prompt Baskets
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-[var(--color-text-secondary)]">
          Run curated query sets and measure before/after shopping trigger scores
        </p>
      </div>

      <BasketPicker
        baskets={baskets}
        selected={selected}
        onSelect={handleRun}
        loading={loading}
      />

      {loading && (
        <div className="flex flex-col items-center gap-3 py-16">
          <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-accent)]/30 border-t-[var(--color-accent)]" />
          <p className="text-[13px] text-[var(--color-text-secondary)]">
            Running {selected} basket...
          </p>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-[var(--color-score-low)]/20 bg-[var(--color-score-low)]/[0.05] px-4 py-3 text-[13px] text-[var(--color-score-low)]">
          {error}
        </div>
      )}

      {result && <BasketResults data={result} />}
    </div>
  );
}
