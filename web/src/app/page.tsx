"use client";

import { useState } from "react";

interface SignalDetail {
  score: number;
  found: string;
  missing: string;
  reasoning?: string;
}

interface AuditResult {
  url: string | null;
  product_name: string;
  product_category: string;
  shopping_base_rate: number;
  amazon_test: "PASS" | "FAIL";
  signals: Record<string, SignalDetail>;
  overall_score: number;
  top_strengths: string[];
  critical_gaps: string[];
  sample_queries: string[];
  one_line_verdict: string;
}

const SIGNAL_LABELS: Record<string, string> = {
  semantic_alignment: "Semantic Alignment",
  structured_data: "Structured Data",
  content_structure: "Content Structure",
  query_fanout: "Query Fanout Optimization",
  recency_freshness: "Recency & Freshness",
};

const SIGNAL_WHY: Record<string, string> = {
  semantic_alignment: "Does your content match the prompts people actually ask AI? Pages using the same language as real user queries get cited. Marketing jargon doesn't.",
  structured_data: "AI systems strongly favor FAQ JSON-LD schema over generic article schemas. Machine-readable product data (price, ratings, specs) drives Shopping cards.",
  content_structure: "Heading density, paragraph balance, title length — AI crawlers parse well-structured content with clear hierarchy more effectively.",
  query_fanout: "LLMs inject terms like 'best', 'top', 'reviews', '2026' into their searches. Pages with these fanout terms naturally get discovered.",
  recency_freshness: "Date references, year markers, 'updated' signals tell AI your content is current. Stale pages get deprioritized.",
};

function scoreColor(score: number): string {
  if (score >= 70) return "var(--color-score-high)";
  if (score >= 40) return "var(--color-score-mid)";
  return "var(--color-score-low)";
}

function scoreLabel(score: number): string {
  if (score >= 70) return "Strong";
  if (score >= 40) return "Needs work";
  return "Weak";
}

async function auditPage(url?: string, content?: string): Promise<AuditResult> {
  const res = await fetch("/api/audit-page", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: url || undefined, content: content || undefined }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Audit failed");
  }
  return res.json();
}

export default function Home() {
  const [mode, setMode] = useState<"single" | "compare">("single");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [error, setError] = useState("");
  const [yourInput, setYourInput] = useState("");
  const [competitorInput, setCompetitorInput] = useState("");
  const [loadingCompare, setLoadingCompare] = useState(false);
  const [yourResult, setYourResult] = useState<AuditResult | null>(null);
  const [compResult, setCompResult] = useState<AuditResult | null>(null);
  const [compareError, setCompareError] = useState("");

  const isUrl = (s: string) => /^https?:\/\//.test(s.trim());

  const handleSingleAudit = async () => {
    const val = input.trim();
    if (!val) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      setResult(await auditPage(isUrl(val) ? val : undefined, isUrl(val) ? undefined : val));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleCompare = async () => {
    if (!yourInput.trim() || !competitorInput.trim()) return;
    setLoadingCompare(true);
    setCompareError("");
    setYourResult(null);
    setCompResult(null);
    try {
      const [yr, cr] = await Promise.all([
        auditPage(isUrl(yourInput) ? yourInput : undefined, isUrl(yourInput) ? undefined : yourInput),
        auditPage(isUrl(competitorInput) ? competitorInput : undefined, isUrl(competitorInput) ? undefined : competitorInput),
      ]);
      setYourResult(yr);
      setCompResult(cr);
    } catch (e) {
      setCompareError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoadingCompare(false);
    }
  };

  return (
    <div className="space-y-10">
      <div className="pt-8 text-center space-y-4">
        <h1 className="text-[32px] font-bold tracking-tight text-[var(--color-text-primary)]">AEO Page Auditor</h1>
        <p className="mx-auto max-w-2xl text-[15px] leading-relaxed text-[var(--color-text-secondary)]">
          Profound tells you <span className="text-[var(--color-text-primary)] font-medium">who</span> is winning in AI search.
          This tells you <span className="text-[var(--color-text-primary)] font-medium">why</span> — and what to fix.
        </p>
        <p className="mx-auto max-w-xl text-[13px] text-[var(--color-text-muted)]">
          Audit any page against the 5 dimensions from Profound&apos;s AEO Content Score — trained on millions of top-cited pages.
        </p>
      </div>

      <div className="flex justify-center">
        <div className="inline-flex rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-0.5">
          <button onClick={() => setMode("single")} className={`rounded-md px-4 py-2 text-[13px] font-medium transition-all ${mode === "single" ? "bg-[var(--color-accent)] text-white" : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"}`}>Audit a page</button>
          <button onClick={() => setMode("compare")} className={`rounded-md px-4 py-2 text-[13px] font-medium transition-all ${mode === "compare" ? "bg-[var(--color-accent)] text-white" : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"}`}>You vs Competitor</button>
        </div>
      </div>

      {mode === "single" && (
        <>
          <div className="mx-auto max-w-2xl space-y-3">
            <textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder="Paste a product page URL or product description..." rows={3}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-3 text-[14px] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] outline-none transition-all focus:border-[var(--color-accent)]/40 resize-y" disabled={loading} />
            <div className="flex gap-2">
              <button onClick={handleSingleAudit} disabled={loading || !input.trim()} className="rounded-lg bg-[var(--color-accent)] px-6 py-3 text-[13px] font-medium text-white transition-all hover:opacity-90 active:scale-[0.97] disabled:opacity-30">
                {loading ? <span className="inline-flex items-center gap-2"><span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />Auditing...</span> : "Audit Page"}
              </button>
              <button onClick={() => setInput("Queen Size Memory Foam Mattress. Our premium mattress is designed for comfort. Made with high-quality materials. Available in all sizes. Free shipping. Buy now and sleep better tonight!")} disabled={loading}
                className="rounded-lg border border-[var(--color-border)] px-4 py-3 text-[13px] text-[var(--color-text-muted)] transition-all hover:text-[var(--color-text-secondary)] disabled:opacity-30">Try weak example</button>
              <button onClick={() => setInput("Casper Original Mattress — Queen Size. $1,095. Medium-firm (6/10). 3 layers: AirScape perforated foam for cooling, zoned support for pressure relief at shoulders and hips, durable base. 10-year warranty. 100-night trial. Best for: side and back sleepers. 80\" x 60\" x 11\", 79 lbs. CertiPUR-US certified. Free shipping & returns. Top rated by Wirecutter, Forbes, Good Housekeeping 2026.")} disabled={loading}
                className="rounded-lg border border-[var(--color-border)] px-4 py-3 text-[13px] text-[var(--color-text-muted)] transition-all hover:text-[var(--color-text-secondary)] disabled:opacity-30">Try strong example</button>
            </div>
            {error && <p className="text-[13px] text-[var(--color-score-low)]">{error}</p>}
          </div>
          {result && <SingleResult result={result} />}
        </>
      )}

      {mode === "compare" && (
        <>
          <div className="mx-auto max-w-3xl">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <p className="text-[11px] font-medium uppercase tracking-widest text-[var(--color-accent)]">Your Page</p>
                <textarea value={yourInput} onChange={(e) => setYourInput(e.target.value)} placeholder="Paste your product page URL or content..." rows={4}
                  className="w-full rounded-lg border border-[var(--color-accent)]/30 bg-[var(--color-bg-secondary)] px-4 py-3 text-[13px] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] outline-none transition-all focus:border-[var(--color-accent)]/40 resize-y" disabled={loadingCompare} />
              </div>
              <div className="space-y-2">
                <p className="text-[11px] font-medium uppercase tracking-widest text-[var(--color-score-low)]">Competitor</p>
                <textarea value={competitorInput} onChange={(e) => setCompetitorInput(e.target.value)} placeholder="Paste competitor's product page URL or content..." rows={4}
                  className="w-full rounded-lg border border-[var(--color-score-low)]/30 bg-[var(--color-bg-secondary)] px-4 py-3 text-[13px] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] outline-none transition-all focus:border-[var(--color-score-low)]/40 resize-y" disabled={loadingCompare} />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={handleCompare} disabled={loadingCompare || !yourInput.trim() || !competitorInput.trim()} className="rounded-lg bg-[var(--color-accent)] px-6 py-3 text-[13px] font-medium text-white transition-all hover:opacity-90 active:scale-[0.97] disabled:opacity-30">
                {loadingCompare ? <span className="inline-flex items-center gap-2"><span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />Comparing...</span> : "Compare Pages"}
              </button>
              <button onClick={() => { setYourInput("Queen Size Memory Foam Mattress. Our premium mattress is designed for comfort. Made with high-quality materials. Available in all sizes. Free shipping. Buy now and sleep better tonight!"); setCompetitorInput("Casper Original Mattress — Queen Size. $1,095. Medium-firm (6/10). 3 layers: AirScape perforated foam for cooling, zoned support for pressure relief at shoulders and hips, durable base. 10-year warranty. 100-night trial. Best for: side and back sleepers. 80\" x 60\" x 11\", 79 lbs. CertiPUR-US certified. Free shipping & returns. Top rated by Wirecutter, Forbes, Good Housekeeping 2026."); }} disabled={loadingCompare}
                className="rounded-lg border border-[var(--color-border)] px-4 py-3 text-[13px] text-[var(--color-text-muted)] transition-all hover:text-[var(--color-text-secondary)] disabled:opacity-30">Load example</button>
            </div>
            {compareError && <p className="mt-2 text-[13px] text-[var(--color-score-low)]">{compareError}</p>}
          </div>
          {yourResult && compResult && <CompareResult yours={yourResult} competitor={compResult} />}
        </>
      )}

      <div className="mx-auto max-w-3xl rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4 space-y-2">
        <p className="text-[10px] font-medium uppercase tracking-widest text-[var(--color-text-muted)]">How this works</p>
        <p className="text-[12px] leading-relaxed text-[var(--color-text-muted)]">
          Profound tracks AI search <span className="text-[var(--color-text-secondary)]">outputs</span> — which brands get recommended.
          This audits the <span className="text-[var(--color-text-secondary)]">input</span> — whether your page has the 5 dimensions that Profound&apos;s AEO Content Score identifies as driving AI citations.
          Scores are heuristic approximations of Profound&apos;s 5 AEO Content Score dimensions (semantic alignment, structured data, content structure, query fanout, recency).
          Profound&apos;s actual scores use proprietary ML trained on millions of pages — our heuristics count observable signals as a proxy.
        </p>
      </div>
    </div>
  );
}

function SingleResult({ result }: { result: AuditResult }) {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <p className="text-[15px] font-medium text-[var(--color-text-primary)]">{result.one_line_verdict}</p>
            <div className="flex flex-wrap gap-1.5">
              {result.product_name && <span className="rounded-full bg-white/[0.06] px-2.5 py-0.5 text-[11px] text-[var(--color-text-secondary)]">{result.product_name}</span>}
              <span className="rounded-full bg-white/[0.06] px-2.5 py-0.5 text-[11px] text-[var(--color-text-muted)]">{result.product_category}</span>
              <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${result.amazon_test === "PASS" ? "bg-[var(--color-score-high)]/10 text-[var(--color-score-high)]" : "bg-[var(--color-score-low)]/10 text-[var(--color-score-low)]"}`}>Amazon Test: {result.amazon_test}</span>
            </div>
          </div>
          <div className="text-center">
            <span className="text-[40px] font-bold tabular-nums leading-none" style={{ color: scoreColor(result.overall_score) }}>{result.overall_score}</span>
            <p className="text-[10px] font-medium uppercase tracking-widest text-[var(--color-text-muted)]">{scoreLabel(result.overall_score)}</p>
          </div>
        </div>
      </div>
      <SignalGrid signals={result.signals} />
      <StrengthsGaps strengths={result.top_strengths} gaps={result.critical_gaps} />
      {result.sample_queries.length > 0 && (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4 space-y-2">
          <p className="text-[10px] font-medium uppercase tracking-widest text-[var(--color-text-muted)]">Queries this page could rank for</p>
          {result.sample_queries.map((q, i) => <p key={i} className="text-[12px] text-[var(--color-text-secondary)]">{i + 1}. &ldquo;{q}&rdquo;</p>)}
        </div>
      )}
    </div>
  );
}

function CompareResult({ yours, competitor }: { yours: AuditResult; competitor: AuditResult }) {
  const diff = yours.overall_score - competitor.overall_score;
  const signalKeys = Object.keys(SIGNAL_LABELS);
  const losing = signalKeys.filter(k => (competitor.signals[k]?.score || 0) > (yours.signals[k]?.score || 0) + 10);
  const winning = signalKeys.filter(k => (yours.signals[k]?.score || 0) > (competitor.signals[k]?.score || 0) + 10);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6">
        <div className="grid grid-cols-3 items-center text-center">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-widest text-[var(--color-accent)]">Your Page</p>
            <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">{yours.product_name || "Your product"}</p>
            <p className="text-[48px] font-bold tabular-nums leading-none mt-2" style={{ color: scoreColor(yours.overall_score) }}>{yours.overall_score}</p>
          </div>
          <div>
            <p className="text-[13px] text-[var(--color-text-muted)]">vs</p>
            <p className={`text-[20px] font-bold tabular-nums mt-1 ${diff > 0 ? "text-[var(--color-score-high)]" : diff < 0 ? "text-[var(--color-score-low)]" : "text-[var(--color-text-muted)]"}`}>{diff > 0 ? "+" : ""}{diff}</p>
            <p className="text-[11px] text-[var(--color-text-muted)]">{diff > 10 ? "You're ahead" : diff < -10 ? "You're behind" : "Close match"}</p>
          </div>
          <div>
            <p className="text-[10px] font-medium uppercase tracking-widest text-[var(--color-score-low)]">Competitor</p>
            <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">{competitor.product_name || "Competitor"}</p>
            <p className="text-[48px] font-bold tabular-nums leading-none mt-2" style={{ color: scoreColor(competitor.overall_score) }}>{competitor.overall_score}</p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[10px] font-medium uppercase tracking-widest text-[var(--color-text-muted)]">Signal-by-Signal</p>
        {signalKeys.map(key => {
          const ys = yours.signals[key]?.score || 0;
          const cs = competitor.signals[key]?.score || 0;
          const d = ys - cs;
          const isLosing = cs > ys + 10;
          return (
            <div key={key} className={`rounded-lg border p-4 ${isLosing ? "border-[var(--color-score-low)]/20 bg-[var(--color-score-low)]/[0.03]" : "border-[var(--color-border)] bg-[var(--color-bg-card)]"}`}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[13px] font-medium text-[var(--color-text-primary)]">{SIGNAL_LABELS[key]}</p>
                <div className="flex items-center gap-4 text-[13px] font-bold tabular-nums">
                  <span style={{ color: scoreColor(ys) }}>{ys}</span>
                  <span className={`text-[11px] ${d > 0 ? "text-[var(--color-score-high)]" : d < 0 ? "text-[var(--color-score-low)]" : "text-[var(--color-text-muted)]"}`}>{d > 0 ? "+" : ""}{d}</span>
                  <span style={{ color: scoreColor(cs) }}>{cs}</span>
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-10 text-[10px] text-[var(--color-accent)]">You</span>
                  <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden"><div className="h-full rounded-full" style={{ width: `${ys}%`, backgroundColor: scoreColor(ys) }} /></div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-10 text-[10px] text-[var(--color-text-muted)]">Comp</span>
                  <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden"><div className="h-full rounded-full" style={{ width: `${cs}%`, backgroundColor: scoreColor(cs) }} /></div>
                </div>
              </div>
              <p className="mt-2 text-[11px] text-[var(--color-text-muted)]">{SIGNAL_WHY[key]}</p>
              {isLosing && competitor.signals[key]?.found && <p className="mt-1 text-[11px] text-[var(--color-score-low)]">Competitor has: {competitor.signals[key].found}</p>}
              {isLosing && yours.signals[key]?.missing && <p className="mt-0.5 text-[11px] text-[var(--color-score-mid)]">You should add: {yours.signals[key].missing}</p>}
            </div>
          );
        })}
      </div>

      {losing.length > 0 && (
        <div className="rounded-xl border border-[var(--color-score-low)]/20 bg-[var(--color-score-low)]/[0.03] p-5 space-y-3">
          <p className="text-[12px] font-medium uppercase tracking-widest text-[var(--color-score-low)]">Why they&apos;re winning</p>
          {losing.map(key => (
            <p key={key} className="flex items-start gap-2 text-[13px] text-[var(--color-text-secondary)]">
              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[var(--color-score-low)] flex-shrink-0" />
              <span><span className="font-medium">{SIGNAL_LABELS[key]}:</span> They score {competitor.signals[key]?.score || 0} vs your {yours.signals[key]?.score || 0}.{yours.signals[key]?.missing ? ` Fix: ${yours.signals[key].missing}` : ""}</span>
            </p>
          ))}
        </div>
      )}

      {winning.length > 0 && (
        <div className="rounded-xl border border-[var(--color-score-high)]/20 bg-[var(--color-score-high)]/[0.03] p-5 space-y-3">
          <p className="text-[12px] font-medium uppercase tracking-widest text-[var(--color-score-high)]">Where you&apos;re ahead</p>
          {winning.map(key => (
            <p key={key} className="flex items-start gap-2 text-[13px] text-[var(--color-text-secondary)]">
              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[var(--color-score-high)] flex-shrink-0" />
              <span><span className="font-medium">{SIGNAL_LABELS[key]}:</span> You score {yours.signals[key]?.score || 0} vs their {competitor.signals[key]?.score || 0}.</span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function SignalGrid({ signals }: { signals: Record<string, SignalDetail> }) {
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-medium uppercase tracking-widest text-[var(--color-text-muted)]">5 AEO Content Dimensions (heuristic approximation of Profound&apos;s AEO Content Score)</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {Object.entries(signals).map(([key, signal]) => (
          <div key={key} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-medium text-[var(--color-text-primary)]">{SIGNAL_LABELS[key] || key}</p>
              <span className="text-[15px] font-bold tabular-nums" style={{ color: scoreColor(signal.score) }}>{signal.score}</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full rounded-full" style={{ width: `${signal.score}%`, backgroundColor: scoreColor(signal.score) }} /></div>
            {signal.found && <p className="text-[11px] text-[var(--color-score-high)]/80"><span className="font-medium text-[var(--color-score-high)]">Found:</span> {signal.found}</p>}
            {signal.missing && <p className="text-[11px] text-[var(--color-score-mid)]/80"><span className="font-medium text-[var(--color-score-mid)]">Add:</span> {signal.missing}</p>}
            {signal.reasoning && (
              <p className="mt-1 text-[10px] text-[var(--color-text-muted)]/60 italic">{signal.reasoning}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function StrengthsGaps({ strengths, gaps }: { strengths: string[]; gaps: string[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 space-y-2">
        <p className="text-[10px] font-medium uppercase tracking-widest text-[var(--color-score-high)]">Strengths</p>
        {strengths.length > 0 ? strengths.map((s, i) => <p key={i} className="flex items-start gap-2 text-[12px] text-[var(--color-text-secondary)]"><span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[var(--color-score-high)]" />{s}</p>) : <p className="text-[12px] text-[var(--color-text-muted)]">No strong signals</p>}
      </div>
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 space-y-2">
        <p className="text-[10px] font-medium uppercase tracking-widest text-[var(--color-score-low)]">Critical Gaps</p>
        {gaps.length > 0 ? gaps.map((g, i) => <p key={i} className="flex items-start gap-2 text-[12px] text-[var(--color-text-secondary)]"><span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[var(--color-score-low)]" />{g}</p>) : <p className="text-[12px] text-[var(--color-text-muted)]">No critical gaps</p>}
      </div>
    </div>
  );
}
