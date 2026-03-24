"use client";

import { useState } from "react";

interface ValidationResult {
  query: string;
  chatgpt_response: string;
  natural_response: string;
  shopping_response: string;
  has_product_recs: boolean;
  organic_trigger: boolean;
  probed_trigger: boolean;
  product_count: number;
  has_prices: boolean;
  has_comparisons: boolean;
  has_specific_brands: boolean;
  product_names: string[];
  shopping_products: string[];
  confidence: number;
  trigger_score: number;
  profound_prediction: string;
  amazon_test: boolean;
  has_constraints: boolean;
  detected_category: string;
  category_display: string;
  heuristic_score: number;
  model: string;
}

function scoreColor(score: number): string {
  if (score >= 50) return "var(--color-score-high)";
  if (score >= 25) return "var(--color-score-mid)";
  return "var(--color-score-low)";
}

const DEMO_QUERIES = [
  "best mattress for back pain",
  "i want to sleep better",
  "what's the difference between memory foam and hybrid mattresses",
  "noise cancelling headphones under $300",
  "how to organize my home office",
];

export default function ValidatePage() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [error, setError] = useState("");

  const handleValidate = async (q?: string) => {
    const queryText = q || query.trim();
    if (!queryText) return;
    if (q) setQuery(q);
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: queryText }),
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      setResult(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Validation failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-10">
      <div className="pt-4 text-center space-y-3">
        <h1 className="text-[32px] font-bold tracking-tight text-[var(--color-text-primary)]">
          Does this query trigger product recommendations?
        </h1>
        <p className="mx-auto max-w-xl text-[15px] leading-relaxed text-[var(--color-text-secondary)]">
          Type any query. We send it to ChatGPT with real web search and check if it recommends products.
        </p>
      </div>

      {/* Input */}
      <div className="mx-auto max-w-2xl space-y-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleValidate()}
            placeholder="Enter a query to validate against ChatGPT..."
            className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-3 text-[14px] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] outline-none transition-all focus:border-[var(--color-accent)]/40"
            disabled={loading}
          />
          <button
            onClick={() => handleValidate()}
            disabled={loading || !query.trim()}
            className="rounded-lg bg-[var(--color-accent)] px-5 py-3 text-[13px] font-medium text-white transition-all hover:opacity-90 active:scale-[0.97] disabled:opacity-30"
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Validating...
              </span>
            ) : (
              "Validate"
            )}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {DEMO_QUERIES.map((q) => (
            <button
              key={q}
              onClick={() => handleValidate(q)}
              disabled={loading}
              className="rounded-full border border-[var(--color-border)] px-3 py-1.5 text-[12px] text-[var(--color-text-muted)] transition-all hover:border-[var(--color-text-muted)]/40 hover:text-[var(--color-text-secondary)] active:scale-[0.97] disabled:opacity-30"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mx-auto max-w-2xl rounded-lg border border-[var(--color-score-low)]/20 bg-[var(--color-score-low)]/[0.05] px-4 py-3 text-[13px] text-[var(--color-score-low)]">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center gap-3 py-8">
          <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-accent)]/30 border-t-[var(--color-accent)]" />
          <p className="text-[13px] text-[var(--color-text-muted)]">Querying ChatGPT with web search + probing for products...</p>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="mx-auto max-w-3xl space-y-6">
          {/* Summary Card */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-3">
                <p className="text-[14px] text-[var(--color-text-secondary)]">&ldquo;{result.query}&rdquo;</p>
                <div className="flex items-center gap-3">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-medium ${
                    result.has_product_recs
                      ? "border border-[var(--color-score-high)]/20 bg-[var(--color-score-high)]/[0.08] text-[var(--color-score-high)]"
                      : "border border-[var(--color-score-low)]/20 bg-[var(--color-score-low)]/[0.08] text-[var(--color-score-low)]"
                  }`}>
                    <span className={`inline-block h-1.5 w-1.5 rounded-full ${result.has_product_recs ? "bg-[var(--color-score-high)]" : "bg-[var(--color-score-low)]"}`} />
                    {result.has_product_recs ? "Products Found" : "No Products"}
                  </span>
                  {result.organic_trigger && (
                    <span className="rounded-full bg-[var(--color-score-high)]/10 px-2 py-0.5 text-[10px] font-medium text-[var(--color-score-high)]">
                      Organic Trigger
                    </span>
                  )}
                  {!result.organic_trigger && result.probed_trigger && (
                    <span className="rounded-full bg-[var(--color-score-mid)]/10 px-2 py-0.5 text-[10px] font-medium text-[var(--color-score-mid)]">
                      Probed Trigger
                    </span>
                  )}
                  <span className="text-[11px] text-[var(--color-text-muted)]">
                    {result.product_count} products &middot; {Math.round(result.confidence * 100)}% confidence
                  </span>
                </div>
              </div>
              <div className="text-center">
                <p className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">Shopping Prediction</p>
                <p className="text-[16px] font-bold mt-1" style={{
                  color: result.profound_prediction === "very_likely" ? "var(--color-score-high)"
                    : result.profound_prediction === "likely" ? "var(--color-score-mid)"
                    : "var(--color-score-low)"
                }}>
                  {result.profound_prediction === "very_likely" ? "Very Likely"
                    : result.profound_prediction === "likely" ? "Likely"
                    : "Unlikely"}
                </p>
              </div>
            </div>
          </div>

          {/* Profound's Shopping Trigger Decision Tree */}
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 space-y-3">
            <p className="text-[10px] font-medium uppercase tracking-widest text-[var(--color-text-muted)]">
              Profound&apos;s Shopping Trigger Decision Tree (95-97% accuracy)
            </p>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className={`inline-block h-2.5 w-2.5 rounded-full flex-shrink-0 ${result.amazon_test ? "bg-[var(--color-score-high)]" : "bg-[var(--color-score-low)]"}`} />
                <span className="text-[12px] text-[var(--color-text-secondary)]">
                  <span className="font-medium">Amazon Test:</span> Is the main noun something you could buy on Amazon?
                  {result.detected_category !== "none" && <span className="text-[var(--color-text-muted)]"> — detected &ldquo;{result.category_display}&rdquo;</span>}
                </span>
                <span className={`text-[11px] font-medium ${result.amazon_test ? "text-[var(--color-score-high)]" : "text-[var(--color-score-low)]"}`}>
                  {result.amazon_test ? "PASS" : "FAIL"}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className={`inline-block h-2.5 w-2.5 rounded-full flex-shrink-0 ${result.has_constraints ? "bg-[var(--color-score-high)]" : "bg-[var(--color-text-muted)]"}`} />
                <span className="text-[12px] text-[var(--color-text-secondary)]">
                  <span className="font-medium">Constraints:</span> Does the query have 1-2 concrete constraints (price, features, use case)?
                </span>
                <span className={`text-[11px] font-medium ${result.has_constraints ? "text-[var(--color-score-high)]" : "text-[var(--color-text-muted)]"}`}>
                  {result.has_constraints ? "YES" : "NO"}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className={`inline-block h-2.5 w-2.5 rounded-full flex-shrink-0 ${result.organic_trigger ? "bg-[var(--color-score-high)]" : "bg-[var(--color-score-low)]"}`} />
                <span className="text-[12px] text-[var(--color-text-secondary)]">
                  <span className="font-medium">Organic Trigger:</span> Did ChatGPT actually recommend products without being asked?
                </span>
                <span className={`text-[11px] font-medium ${result.organic_trigger ? "text-[var(--color-score-high)]" : "text-[var(--color-score-low)]"}`}>
                  {result.organic_trigger ? "YES" : "NO"}
                </span>
              </div>
            </div>
            <p className="text-[10px] text-[var(--color-text-muted)]/60 italic">
              Source: Profound &mdash; &ldquo;If the prompt&apos;s main noun is something you could buy on Amazon, Shopping is likely to appear. Adding 1-2 concrete constraints increases trigger probability.&rdquo; 95-97% accuracy on 7,500-prompt labeled sample.
            </p>
          </div>

          {/* Response Signals */}
          <div className="flex flex-wrap gap-2">
            <Signal label="Prices" active={result.has_prices} />
            <Signal label="Comparisons" active={result.has_comparisons} />
            <Signal label="Brands" active={result.has_specific_brands} />
            <Signal label="Organic" active={result.organic_trigger} />
            <Signal label="Probed" active={result.probed_trigger} />
          </div>

          {/* Organic Product Names */}
          {result.product_names.length > 0 && (
            <div className="rounded-lg border border-[var(--color-score-high)]/20 bg-[var(--color-score-high)]/[0.03] p-4 space-y-2">
              <p className="text-[10px] font-medium uppercase tracking-widest text-[var(--color-score-high)]">
                Organic Products — ChatGPT recommended without being asked ({result.product_names.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {result.product_names.map((p, i) => (
                  <span key={i} className="rounded-md border border-[var(--color-score-high)]/20 bg-[var(--color-score-high)]/[0.06] px-2.5 py-1 text-[11px] text-[var(--color-text-secondary)]">
                    {p}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Shopping Probe Products */}
          {result.shopping_products && result.shopping_products.length > 0 && (
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 space-y-2">
              <p className="text-[10px] font-medium uppercase tracking-widest text-[var(--color-score-mid)]">
                Shopping Probe — products when explicitly asked ({result.shopping_products.length})
              </p>
              <p className="text-[10px] text-[var(--color-text-muted)]">
                These products would appear as Shopping cards on chatgpt.com. The API doesn&apos;t have Shopping, so we probe explicitly.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {result.shopping_products.map((p, i) => (
                  <span key={i} className="rounded-md border border-[var(--color-border)] bg-white/[0.03] px-2.5 py-1 text-[11px] text-[var(--color-text-muted)]">
                    {p}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Natural Response */}
          {result.natural_response && (
            <details className="group">
              <summary className="cursor-pointer rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-3 text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]">
                View natural ChatGPT response (organic)
              </summary>
              <pre className="mt-2 max-h-[300px] overflow-auto whitespace-pre-wrap rounded-lg bg-[var(--color-bg-secondary)] p-4 text-[12px] leading-relaxed text-[var(--color-text-muted)]">
                {result.natural_response}
              </pre>
            </details>
          )}

          {/* Shopping Probe Response */}
          {result.shopping_response && (
            <details className="group">
              <summary className="cursor-pointer rounded-lg border border-[var(--color-accent)]/20 bg-[var(--color-accent-glow)] px-4 py-3 text-[12px] text-[var(--color-accent)] hover:text-[var(--color-accent-bright)]">
                View product recommendation probe (Shopping simulation)
              </summary>
              <pre className="mt-2 max-h-[300px] overflow-auto whitespace-pre-wrap rounded-lg bg-[var(--color-bg-secondary)] p-4 text-[12px] leading-relaxed text-[var(--color-text-muted)]">
                {result.shopping_response}
              </pre>
            </details>
          )}

          {/* Methodology Note */}
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4 space-y-2">
            <p className="text-[10px] font-medium uppercase tracking-widest text-[var(--color-text-muted)]">How this works</p>
            <p className="text-[12px] leading-relaxed text-[var(--color-text-muted)]">
              <span className="text-[var(--color-text-secondary)]">Step 1:</span> Sends your query to ChatGPT with real web search enabled (Responses API + web_search_preview).{" "}
              <span className="text-[var(--color-text-secondary)]">Step 2:</span> Probes ChatGPT for specific product recommendations — simulating Shopping behavior.{" "}
              <span className="text-[var(--color-text-secondary)]">Step 3:</span> Analyzes both responses for brands, products, prices, and comparisons.
            </p>
            <p className="text-[11px] text-[var(--color-text-muted)]/60">
              &ldquo;Organic Trigger&rdquo; = ChatGPT recommended products without being asked.
              &ldquo;Probed Trigger&rdquo; = products found when explicitly asked — simulates ChatGPT Shopping cards.
            </p>
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
