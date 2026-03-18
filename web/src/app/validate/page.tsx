"use client";

import { useState, useEffect } from "react";
import type { ValidationResult, ValidationStats } from "@/lib/api";
import {
  validateQuery,
  getValidationStats,
  getRecentValidations,
} from "@/lib/api";

export default function ValidatePage() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [stats, setStats] = useState<ValidationStats | null>(null);
  const [recent, setRecent] = useState<ValidationResult[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    getValidationStats().then(setStats).catch(() => {});
    getRecentValidations(20).then(setRecent).catch(() => {});
  }, []);

  const handleValidate = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await validateQuery(query.trim());
      setResult(res);
      // Refresh stats
      getValidationStats().then(setStats);
      getRecentValidations(20).then(setRecent);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Validation failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-10">
      <div className="glow-blue pt-4 text-center">
        <h1 className="text-[28px] font-semibold tracking-tight text-[var(--color-text-primary)]">
          Ground Truth Validation
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-[var(--color-text-secondary)]">
          Send queries to ChatGPT and verify if they actually trigger product recommendations
        </p>
      </div>

      {/* Input */}
      <div className="mx-auto max-w-2xl">
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleValidate()}
            placeholder="Enter a query to validate against ChatGPT..."
            className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-3 text-[14px] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] outline-none transition-all duration-200 focus:border-[var(--color-accent)]/40"
            disabled={loading}
          />
          <button
            onClick={handleValidate}
            disabled={loading || !query.trim()}
            className="rounded-lg bg-[var(--color-accent)] px-5 py-3 text-[13px] font-medium text-white transition-all duration-200 hover:opacity-90 active:scale-[0.97] disabled:opacity-30"
          >
            {loading ? (
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              "Validate"
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-[var(--color-score-low)]/20 bg-[var(--color-score-low)]/[0.05] px-4 py-3 text-[13px] text-[var(--color-score-low)]">
          {error}
        </div>
      )}

      {/* Single result */}
      {result && (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[13px] text-[var(--color-text-secondary)]">&ldquo;{result.query}&rdquo;</p>
              <div className="mt-2 flex items-center gap-3">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-medium ${
                  result.has_product_recs
                    ? "border border-[var(--color-score-high)]/20 bg-[var(--color-score-high)]/[0.08] text-[var(--color-score-high)]"
                    : "border border-[var(--color-score-low)]/20 bg-[var(--color-score-low)]/[0.08] text-[var(--color-score-low)]"
                }`}>
                  <span className={`inline-block h-1.5 w-1.5 rounded-full ${result.has_product_recs ? "bg-[var(--color-score-high)]" : "bg-[var(--color-score-low)]"}`} />
                  {result.has_product_recs ? "Products Triggered" : "No Products"}
                </span>
                <span className="text-[11px] text-[var(--color-text-muted)]">
                  {result.product_count} products · {result.confidence.toFixed(0)}% confidence
                </span>
              </div>
            </div>
            <div className="flex gap-4 text-center">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">GPT Score</p>
                <p className="text-xl font-bold tabular-nums" style={{
                  color: result.trigger_score >= 50 ? "var(--color-score-high)" : result.trigger_score >= 25 ? "var(--color-score-mid)" : "var(--color-score-low)"
                }}>{result.trigger_score}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">Heuristic</p>
                <p className="text-xl font-bold tabular-nums text-[var(--color-text-secondary)]">{result.heuristic_score}</p>
              </div>
            </div>
          </div>

          {/* Signals */}
          <div className="flex flex-wrap gap-2">
            {result.has_prices && <Signal label="Prices" active />}
            {result.has_comparisons && <Signal label="Comparisons" active />}
            {result.has_specific_brands && <Signal label="Brands" active />}
            {!result.has_prices && <Signal label="Prices" active={false} />}
            {!result.has_comparisons && <Signal label="Comparisons" active={false} />}
            {!result.has_specific_brands && <Signal label="Brands" active={false} />}
          </div>

          {/* Product names */}
          {result.product_names && result.product_names.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {result.product_names.map((p, i) => (
                <span key={i} className="rounded bg-white/[0.04] px-2 py-0.5 text-[11px] text-[var(--color-text-muted)]">{p}</span>
              ))}
            </div>
          )}

          {/* ChatGPT response preview */}
          <details className="group">
            <summary className="cursor-pointer text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]">
              View ChatGPT response
            </summary>
            <pre className="mt-2 max-h-[300px] overflow-auto whitespace-pre-wrap rounded-lg bg-[var(--color-bg-primary)] p-4 text-[12px] leading-relaxed text-[var(--color-text-secondary)]">
              {result.chatgpt_response}
            </pre>
          </details>
        </div>
      )}

      {/* Aggregate stats */}
      {stats && stats.total > 0 && (
        <div className="space-y-3">
          <h2 className="text-[12px] font-medium uppercase tracking-widest text-[var(--color-text-muted)]">
            Ground Truth Stats ({stats.total} queries validated)
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Trigger Rate" value={`${stats.trigger_rate}%`} color="var(--color-accent)" />
            <Stat label="Avg GPT Score" value={stats.avg_trigger_score?.toFixed(1) ?? "—"} />
            <Stat label="Heuristic (triggered)" value={stats.avg_heuristic_when_triggered?.toFixed(1) ?? "—"} color="var(--color-score-high)" />
            <Stat label="Heuristic (not triggered)" value={stats.avg_heuristic_when_not_triggered?.toFixed(1) ?? "—"} color="var(--color-score-low)" />
          </div>
          <p className="text-[11px] text-[var(--color-text-muted)]">
            If heuristic scores are similar for triggered vs not-triggered, the scorer needs recalibration.
            A good scorer should show a clear gap between the two groups.
          </p>
        </div>
      )}

      {/* Recent validations */}
      {recent.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-[12px] font-medium uppercase tracking-widest text-[var(--color-text-muted)]">
            Recent Validations
          </h2>
          <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
                  <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-widest text-[var(--color-text-muted)]">Query</th>
                  <th className="w-20 px-3 py-3 text-center text-[11px] font-medium uppercase tracking-widest text-[var(--color-text-muted)]">Triggered</th>
                  <th className="w-16 px-3 py-3 text-center text-[11px] font-medium uppercase tracking-widest text-[var(--color-text-muted)]">GPT</th>
                  <th className="w-20 px-3 py-3 text-center text-[11px] font-medium uppercase tracking-widest text-[var(--color-text-muted)]">Heuristic</th>
                  <th className="w-14 px-3 py-3 text-center text-[11px] font-medium uppercase tracking-widest text-[var(--color-text-muted)]">Gap</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((r, i) => {
                  const gap = r.trigger_score - r.heuristic_score;
                  return (
                    <tr key={i} className="border-b border-[var(--color-border)]/50 last:border-0 transition-colors hover:bg-[var(--color-bg-card)]">
                      <td className="max-w-[300px] truncate px-4 py-2.5 text-[var(--color-text-secondary)]">{r.query}</td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={`inline-block h-2 w-2 rounded-full ${r.has_product_recs ? "bg-[var(--color-score-high)]" : "bg-[var(--color-score-low)]"}`} />
                      </td>
                      <td className="px-3 py-2.5 text-center tabular-nums text-[var(--color-text-primary)]">{r.trigger_score}</td>
                      <td className="px-3 py-2.5 text-center tabular-nums text-[var(--color-text-secondary)]">{r.heuristic_score}</td>
                      <td className="px-3 py-2.5 text-center tabular-nums" style={{
                        color: Math.abs(gap) < 15 ? "var(--color-score-high)" : "var(--color-score-low)"
                      }}>
                        {gap > 0 ? "+" : ""}{gap}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Signal({ label, active }: { label: string; active: boolean }) {
  return (
    <span className={`rounded border px-2 py-0.5 text-[11px] ${
      active
        ? "border-[var(--color-score-high)]/20 text-[var(--color-score-high)]"
        : "border-[var(--color-border)] text-[var(--color-text-muted)]"
    }`}>
      {active ? "+" : "-"} {label}
    </span>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
      <p className="text-[10px] font-medium uppercase tracking-widest text-[var(--color-text-muted)]">{label}</p>
      <p className="mt-1.5 text-2xl font-bold tabular-nums tracking-tight" style={{ color: color ?? "var(--color-text-primary)" }}>{value}</p>
    </div>
  );
}
