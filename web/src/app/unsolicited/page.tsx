"use client";

import { useState } from "react";

interface QueryResult {
  query: string;
  response_preview: string;
  has_unsolicited_recs: boolean;
  product_names: string[];
  rec_type: string;
  explanation: string;
}

interface Measurement {
  total_queries: number;
  triggered_count: number;
  trigger_rate: number;
  soft_recs: number;
  explicit_recs: number;
  top_products: { name: string; mentions: number }[];
  queries_that_triggered: { query: string; products: string[]; type: string }[];
  queries_that_didnt: string[];
}

interface Analysis {
  summary: string;
  benchmark_comparison: string;
  pattern_insights: string[];
  brand_implications: string[];
}

type StepStatus = "pending" | "active" | "complete" | "error";

const STEPS = [
  "Generating informational queries",
  "Probing ChatGPT (15 queries with web search)",
  "Calculating unsolicited rec rate",
  "Analyzing patterns",
];

const DEMO_CATEGORIES = ["mattresses", "wireless earbuds", "skincare", "standing desks", "protein powder"];

export default function UnsolicitedPage() {
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [stepStatuses, setStepStatuses] = useState<StepStatus[]>(STEPS.map(() => "pending"));
  const [currentStep, setCurrentStep] = useState(-1);
  const [queries, setQueries] = useState<string[] | null>(null);
  const [results, setResults] = useState<QueryResult[] | null>(null);
  const [measurement, setMeasurement] = useState<Measurement | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);

  const [expandedQuery, setExpandedQuery] = useState<number | null>(null);

  const updateStep = (idx: number, status: StepStatus) => {
    setStepStatuses((prev) => { const next = [...prev]; next[idx] = status; return next; });
  };

  const handleSubmit = async (cat?: string) => {
    const c = cat || category.trim();
    if (!c) return;
    if (cat) setCategory(cat);

    setLoading(true);
    setError("");
    setQueries(null);
    setResults(null);
    setMeasurement(null);
    setAnalysis(null);
    setExpandedQuery(null);
    setStepStatuses(STEPS.map(() => "pending"));
    setCurrentStep(0);
    updateStep(0, "active");

    try {
      const res = await fetch("/api/unsolicited", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: c }),
      });

      if (!res.ok) throw new Error(`API error: ${res.status}`);

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);

            if (event.step === "status" && typeof event.stage === "number") {
              for (let s = 0; s < event.stage; s++) updateStep(s, "complete");
              setCurrentStep(event.stage);
              updateStep(event.stage, "active");
            } else if (event.step === "queries") {
              setQueries(event.queries);
            } else if (event.step === "responses") {
              setResults(event.results);
            } else if (event.step === "measurement") {
              setMeasurement(event.measurement);
            } else if (event.step === "analysis") {
              setAnalysis(event.analysis);
            } else if (event.step === "complete") {
              STEPS.forEach((_, i) => updateStep(i, "complete"));
              setCurrentStep(STEPS.length);
            } else if (event.step === "error") {
              setError(event.message);
            }
          } catch { /* skip malformed */ }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-10">
      <div className="pt-8 text-center space-y-4">
        <h1 className="text-[32px] font-bold tracking-tight text-[var(--color-text-primary)]">
          Unsolicited Rec Rate Tester
        </h1>
        <p className="mx-auto max-w-2xl text-[15px] leading-relaxed text-[var(--color-text-secondary)]">
          Measure how often ChatGPT inserts <span className="text-[var(--color-text-primary)] font-medium">unsolicited product recommendations</span> into
          informational answers for your category
        </p>
        <p className="mx-auto max-w-xl text-[13px] text-[var(--color-text-muted)]">
          Sends 15 real informational queries to ChatGPT with web search. Counts how many responses include
          product recommendations the user didn&apos;t ask for. Real measurement, not an estimate.
        </p>
      </div>

      {/* Input */}
      <div className="mx-auto max-w-2xl space-y-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="Enter a product category (e.g. mattresses, headphones, skincare)"
            className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-3 text-[14px] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] outline-none transition-all focus:border-[var(--color-accent)]/40"
            disabled={loading}
          />
          <button
            onClick={() => handleSubmit()}
            disabled={loading || !category.trim()}
            className="rounded-lg bg-[var(--color-accent)] px-6 py-3 text-[13px] font-medium text-white transition-all hover:opacity-90 active:scale-[0.97] disabled:opacity-30"
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Measuring...
              </span>
            ) : (
              "Measure Rate"
            )}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {DEMO_CATEGORIES.map((c) => (
            <button key={c} onClick={() => handleSubmit(c)} disabled={loading}
              className="rounded-full border border-[var(--color-border)] px-3 py-1.5 text-[12px] text-[var(--color-text-muted)] transition-all hover:border-[var(--color-text-muted)]/40 hover:text-[var(--color-text-secondary)] active:scale-[0.97] disabled:opacity-30">
              {c}
            </button>
          ))}
        </div>
        {error && <p className="text-[13px] text-[var(--color-score-low)]">{error}</p>}
      </div>

      {/* Progressive Stepper */}
      {currentStep >= 0 && (
        <div className="mx-auto max-w-md">
          {STEPS.map((label, i) => {
            const status = stepStatuses[i];
            return (
              <div key={i} className="flex items-start gap-3">
                <div className="flex flex-col items-center">
                  <div className={`flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all ${
                    status === "complete" ? "border-[var(--color-score-high)] bg-[var(--color-score-high)]"
                    : status === "active" ? "border-[var(--color-accent)] bg-[var(--color-accent)]"
                    : "border-[var(--color-border)] bg-transparent"
                  }`}>
                    {status === "complete" ? (
                      <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : status === "active" ? (
                      <span className="inline-block h-2.5 w-2.5 animate-spin rounded-full border border-white/30 border-t-white" />
                    ) : null}
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={`w-px h-6 transition-colors ${status === "complete" ? "bg-[var(--color-score-high)]" : "bg-[var(--color-border)]"}`} />
                  )}
                </div>
                <p className={`pt-0.5 text-[13px] transition-colors ${
                  status === "active" ? "text-[var(--color-text-primary)] font-medium"
                  : status === "complete" ? "text-[var(--color-score-high)]"
                  : "text-[var(--color-text-muted)]"
                }`}>{label}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Main Result: Measured Rate */}
      {measurement && (
        <div className="mx-auto max-w-3xl space-y-6">
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6 text-center">
            <p className="text-[10px] font-medium uppercase tracking-widest text-[var(--color-text-muted)]">
              Measured Unsolicited Recommendation Rate for &ldquo;{category}&rdquo;
            </p>
            <p className="text-[56px] font-bold tabular-nums leading-none mt-3" style={{
              color: measurement.trigger_rate >= 30 ? "var(--color-score-high)"
                : measurement.trigger_rate >= 15 ? "var(--color-score-mid)"
                : "var(--color-score-low)"
            }}>
              {measurement.trigger_rate}%
            </p>
            <p className="text-[14px] text-[var(--color-text-secondary)] mt-2">
              {measurement.triggered_count} of {measurement.total_queries} informational queries triggered unsolicited product recommendations
            </p>
            <div className="flex justify-center gap-6 mt-4">
              <div>
                <p className="text-[20px] font-bold tabular-nums text-[var(--color-text-primary)]">{measurement.explicit_recs}</p>
                <p className="text-[10px] text-[var(--color-text-muted)]">Explicit recs</p>
              </div>
              <div>
                <p className="text-[20px] font-bold tabular-nums text-[var(--color-text-secondary)]">{measurement.soft_recs}</p>
                <p className="text-[10px] text-[var(--color-text-muted)]">Soft mentions</p>
              </div>
              <div>
                <p className="text-[20px] font-bold tabular-nums text-[var(--color-text-muted)]">{measurement.total_queries - measurement.triggered_count}</p>
                <p className="text-[10px] text-[var(--color-text-muted)]">No recs</p>
              </div>
            </div>
            <p className="text-[11px] text-[var(--color-text-muted)] mt-4">
              Profound&apos;s benchmark: unsolicited recs grew from 15% to 28% overall (Sep 2025 → Jan 2026, per their LinkedIn research on 100k shopping prompts)
            </p>
          </div>

          {/* Top Products Mentioned */}
          {measurement.top_products.length > 0 && (
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 space-y-2">
              <p className="text-[10px] font-medium uppercase tracking-widest text-[var(--color-text-muted)]">
                Products ChatGPT recommended unsolicited ({measurement.top_products.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {measurement.top_products.map((p, i) => (
                  <span key={i} className="rounded-md border border-[var(--color-score-high)]/20 bg-[var(--color-score-high)]/[0.06] px-2.5 py-1 text-[11px] text-[var(--color-text-secondary)]">
                    {p.name} ({p.mentions}x)
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Query-by-query results */}
          {results && (
            <div className="space-y-2">
              <p className="text-[10px] font-medium uppercase tracking-widest text-[var(--color-text-muted)]">
                Query-by-query results ({results.length} queries)
              </p>
              {results.map((r, i) => {
                const expanded = expandedQuery === i;
                return (
                  <div key={i} className={`rounded-lg border transition-colors ${
                    r.has_unsolicited_recs
                      ? r.rec_type === "explicit"
                        ? "border-[var(--color-score-high)]/30 bg-[var(--color-score-high)]/[0.03]"
                        : "border-[var(--color-score-mid)]/30 bg-[var(--color-score-mid)]/[0.03]"
                      : "border-[var(--color-border)] bg-[var(--color-bg-card)]"
                  }`}>
                    <button onClick={() => setExpandedQuery(expanded ? null : i)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                      <span className="w-5 shrink-0 text-center text-[12px] tabular-nums text-[var(--color-text-muted)]">{i + 1}</span>
                      <span className="flex-1 text-[13px] text-[var(--color-text-secondary)]">&ldquo;{r.query}&rdquo;</span>
                      {r.has_unsolicited_recs ? (
                        <span className={`rounded-full px-2 py-0.5 text-[9px] font-medium uppercase tracking-widest ${
                          r.rec_type === "explicit"
                            ? "bg-[var(--color-score-high)]/10 text-[var(--color-score-high)]"
                            : "bg-[var(--color-score-mid)]/10 text-[var(--color-score-mid)]"
                        }`}>
                          {r.rec_type}
                        </span>
                      ) : (
                        <span className="rounded-full bg-white/[0.04] px-2 py-0.5 text-[9px] text-[var(--color-text-muted)]">none</span>
                      )}
                      <svg className={`h-4 w-4 shrink-0 text-[var(--color-text-muted)] transition-transform ${expanded ? "rotate-180" : ""}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {expanded && (
                      <div className="border-t border-[var(--color-border)]/50 px-4 py-3 space-y-2">
                        <p className="text-[11px] text-[var(--color-text-muted)]">{r.explanation}</p>
                        {r.product_names.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {r.product_names.map((p, j) => (
                              <span key={j} className="rounded-md border border-[var(--color-score-high)]/20 bg-[var(--color-score-high)]/[0.06] px-2 py-0.5 text-[10px] text-[var(--color-text-secondary)]">{p}</span>
                            ))}
                          </div>
                        )}
                        <details>
                          <summary className="cursor-pointer text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]">View response</summary>
                          <p className="mt-1 rounded-md bg-[var(--color-bg-secondary)] p-2 text-[11px] text-[var(--color-text-muted)] leading-relaxed">{r.response_preview}</p>
                        </details>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Analysis */}
          {analysis && (
            <div className="space-y-4">
              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4 space-y-2">
                <p className="text-[13px] leading-relaxed text-[var(--color-text-secondary)]">{analysis.summary}</p>
                <p className="text-[12px] text-[var(--color-text-muted)]">{analysis.benchmark_comparison}</p>
              </div>

              {analysis.pattern_insights && analysis.pattern_insights.length > 0 && (
                <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 space-y-2">
                  <p className="text-[10px] font-medium uppercase tracking-widest text-[var(--color-text-muted)]">Pattern insights</p>
                  {analysis.pattern_insights.map((insight, i) => (
                    <p key={i} className="flex items-start gap-2 text-[12px] text-[var(--color-text-secondary)]">
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[var(--color-accent)]" />
                      {insight}
                    </p>
                  ))}
                </div>
              )}

              {analysis.brand_implications && analysis.brand_implications.length > 0 && (
                <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 space-y-2">
                  <p className="text-[10px] font-medium uppercase tracking-widest text-[var(--color-text-muted)]">What this means for brands</p>
                  {analysis.brand_implications.map((imp, i) => (
                    <p key={i} className="flex items-start gap-2 text-[12px] text-[var(--color-text-secondary)]">
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[var(--color-score-mid)]" />
                      {imp}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Methodology */}
          {!loading && measurement && (
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4 space-y-2">
              <p className="text-[10px] font-medium uppercase tracking-widest text-[var(--color-text-muted)]">Methodology</p>
              <p className="text-[12px] leading-relaxed text-[var(--color-text-muted)]">
                Generated {measurement.total_queries} informational queries about &ldquo;{category}&rdquo; — queries where the user is NOT shopping.
                Sent each to ChatGPT (gpt-4o-mini with web_search_preview). Analyzed each response to detect if ChatGPT inserted product
                recommendations the user didn&apos;t ask for. Rate = triggered / total. This mirrors Profound&apos;s methodology of testing prompt baskets
                to measure AI behavior at the category level.
              </p>
            </div>
          )}
        </div>
      )}

      {/* How this works (before results) */}
      {!loading && !measurement && (
        <div className="mx-auto max-w-3xl rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4 space-y-2">
          <p className="text-[10px] font-medium uppercase tracking-widest text-[var(--color-text-muted)]">How this works</p>
          <p className="text-[12px] leading-relaxed text-[var(--color-text-muted)]">
            Profound found that ChatGPT inserts product recommendations into informational answers at increasing rates
            (their LinkedIn research on 100k shopping prompts). This tool measures the actual rate for YOUR category by
            sending 15 informational queries to ChatGPT and counting how many responses include unsolicited product recommendations.
            Real data, not estimates.
          </p>
        </div>
      )}
    </div>
  );
}
