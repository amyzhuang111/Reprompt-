"use client";

import { useState, useCallback } from "react";
import type { RewriteVariant, ScoreBreakdown } from "@/types/reprompt";
import { rewriteQueryStream } from "@/lib/api";
import QueryInput from "@/components/QueryInput";
import ScoreComparison from "@/components/ScoreComparison";
import RewriteCard from "@/components/RewriteCard";

const DEMO_QUERIES = [
  "I've been having trouble sleeping lately",
  "what's a good price for a couch?",
  "credit card tips",
  "how do I organize my home office?",
];

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Streaming state
  const [originalQuery, setOriginalQuery] = useState("");
  const [originalScore, setOriginalScore] = useState(0);
  const [originalBreakdown, setOriginalBreakdown] = useState<ScoreBreakdown | null>(null);
  const [rewrites, setRewrites] = useState<RewriteVariant[]>([]);
  const [metadata, setMetadata] = useState<Record<string, string | number>>({});

  const handleSubmit = useCallback(async (query: string) => {
    setLoading(true);
    setError("");
    setOriginalQuery("");
    setOriginalScore(0);
    setOriginalBreakdown(null);
    setRewrites([]);
    setMetadata({});

    await rewriteQueryStream(query, 8, {
      onOriginal: (q, score, breakdown) => {
        setOriginalQuery(q);
        setOriginalScore(score);
        setOriginalBreakdown(breakdown);
      },
      onRewrite: (variant) => {
        setRewrites((prev) =>
          [...prev, variant].sort((a, b) => b.score - a.score)
        );
      },
      onDone: (meta) => {
        setMetadata(meta);
        setLoading(false);
      },
      onError: (err) => {
        setError(err);
        setLoading(false);
      },
    });
  }, []);

  const best = rewrites[0];

  return (
    <div className="space-y-10">
      {/* Hero */}
      <div className="glow-blue pt-4 text-center">
        <h1 className="text-[28px] font-semibold tracking-tight text-[var(--color-text-primary)]">
          Query Rewriter
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-[var(--color-text-secondary)]">
          Optimize customer queries to trigger ChatGPT shopping recommendations
        </p>
      </div>

      {/* Input */}
      <div className="mx-auto max-w-2xl space-y-4">
        <QueryInput onSubmit={handleSubmit} loading={loading} />

        {/* Demo chips */}
        <div className="flex flex-wrap justify-center gap-2">
          {DEMO_QUERIES.map((q) => (
            <button
              key={q}
              onClick={() => handleSubmit(q)}
              disabled={loading}
              className="rounded-full border border-[var(--color-border)] px-3 py-1.5 text-[12px] text-[var(--color-text-muted)] transition-all duration-200 hover:border-[var(--color-text-muted)]/40 hover:text-[var(--color-text-secondary)] active:scale-[0.97] disabled:opacity-30"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-[var(--color-score-low)]/20 bg-[var(--color-score-low)]/[0.05] px-4 py-3 text-[13px] text-[var(--color-score-low)]">
          {error}
        </div>
      )}

      {/* Original score shows immediately */}
      {originalBreakdown && best && (
        <ScoreComparison
          originalScore={originalScore}
          bestScore={best.score}
          originalQuery={originalQuery}
          bestQuery={best.query}
        />
      )}

      {/* Show original score even before rewrites arrive */}
      {originalBreakdown && !best && (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6 text-center">
          <p className="text-[12px] uppercase tracking-widest text-[var(--color-text-muted)]">Original Score</p>
          <p className="mt-2 text-4xl font-bold tabular-nums" style={{
            color: originalScore < 30 ? "var(--color-score-low)" : originalScore < 60 ? "var(--color-score-mid)" : "var(--color-score-high)"
          }}>
            {originalScore}
          </p>
          <p className="mt-2 text-[13px] text-[var(--color-text-secondary)]">&ldquo;{originalQuery}&rdquo;</p>
          <div className="mt-4 flex justify-center">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[var(--color-accent)]/30 border-t-[var(--color-accent)]" />
          </div>
          <p className="mt-2 text-[11px] text-[var(--color-text-muted)]">Generating rewrites...</p>
        </div>
      )}

      {/* Rewrites stream in one by one */}
      {rewrites.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-[12px] font-medium uppercase tracking-widest text-[var(--color-text-muted)]">
              All Rewrites
            </h2>
            <span className="text-[12px] tabular-nums text-[var(--color-text-muted)]">
              {rewrites.length} variants{loading ? "..." : ""}
            </span>
          </div>
          <div className="space-y-2">
            {rewrites.map((v, i) => (
              <div
                key={`${v.query}-${v.strategy}`}
                className="animate-[fadeIn_0.3s_ease-out]"
              >
                <RewriteCard variant={v} rank={i + 1} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Metadata */}
      {metadata.processing_time_ms && (
        <p className="text-[11px] text-[var(--color-text-muted)]">
          {metadata.processing_time_ms}ms
          {metadata.model_version && metadata.model_version !== "mock"
            ? ` · ${metadata.model_version}`
            : " · mock mode"}
        </p>
      )}
    </div>
  );
}
