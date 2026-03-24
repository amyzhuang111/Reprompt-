"use client";

import { useState } from "react";

const DEMO_CHIPS = ["Mattresses", "Wireless earbuds", "Standing desks", "Running shoes"];

interface BrandRank {
  name: string;
  appearances: number;
  share: number;
}

interface QueryResult {
  query: string;
  response_preview: string;
  brands: string[];
  products: string[];
  has_product_recs: boolean;
  recommendation_strength: "strong" | "moderate" | "none";
}

interface CompetitiveResult {
  category: string;
  brand: string | null;
  queries_tested: number;
  queries_with_recs: number;
  rec_rate: number;
  brand_ranking: BrandRank[];
  user_brand_rank: number | null;
  user_brand_appearances: number;
  results: QueryResult[];
}

const STRENGTH_STYLES: Record<string, { bg: string; border: string; text: string; label: string }> = {
  strong: {
    bg: "var(--color-score-high)",
    border: "var(--color-score-high)",
    text: "var(--color-score-high)",
    label: "Strong",
  },
  moderate: {
    bg: "var(--color-score-mid)",
    border: "var(--color-score-mid)",
    text: "var(--color-score-mid)",
    label: "Moderate",
  },
  none: {
    bg: "var(--color-text-muted)",
    border: "var(--color-text-muted)",
    text: "var(--color-text-muted)",
    label: "None",
  },
};

export default function CompetitivePage() {
  const [category, setCategory] = useState("");
  const [brand, setBrand] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<CompetitiveResult | null>(null);

  const handleSubmit = async (chipCategory?: string) => {
    const cat = chipCategory ?? category;
    if (!cat.trim()) return;
    if (chipCategory) setCategory(chipCategory);
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/competitive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: cat.trim(), brand: brand.trim() || undefined }),
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Competitive audit failed");
    } finally {
      setLoading(false);
    }
  };

  const topBrandAppearances = result && result.brand_ranking.length > 0
    ? result.brand_ranking[0].appearances
    : 0;

  return (
    <div className="space-y-10">
      {/* Hero */}
      <div className="glow-blue pt-4 text-center">
        <h1 className="text-[28px] font-semibold tracking-tight text-[var(--color-text-primary)]">
          Competitive Intelligence
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-[var(--color-text-secondary)]">
          See which brands ChatGPT <span className="text-[var(--color-text-primary)] font-medium">actually recommends</span> in your category — live
        </p>
        <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">
          Sends real queries to ChatGPT and extracts brand recommendations. See where you rank.
        </p>
      </div>

      {/* Input */}
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="Product category (e.g. mattresses, wireless earbuds)"
            className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-3 text-[14px] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] outline-none transition-all duration-200 focus:border-[var(--color-accent)]/40"
            disabled={loading}
          />
          <input
            type="text"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="Your brand (optional)"
            className="w-44 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-3 text-[14px] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] outline-none transition-all duration-200 focus:border-[var(--color-accent)]/40"
            disabled={loading}
          />
          <button
            onClick={() => handleSubmit()}
            disabled={loading || !category.trim()}
            className="rounded-lg bg-[var(--color-accent)] px-5 py-3 text-[13px] font-medium text-white transition-all duration-200 hover:opacity-90 active:scale-[0.97] disabled:opacity-30"
          >
            {loading ? (
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              "Run Competitive Audit"
            )}
          </button>
        </div>

        {/* Demo chips */}
        <div className="flex flex-wrap justify-center gap-2">
          {DEMO_CHIPS.map((chip) => (
            <button
              key={chip}
              onClick={() => handleSubmit(chip)}
              disabled={loading}
              className="rounded-full border border-[var(--color-border)] px-3 py-1.5 text-[12px] text-[var(--color-text-muted)] transition-all duration-200 hover:border-[var(--color-text-muted)]/40 hover:text-[var(--color-text-secondary)] active:scale-[0.97] disabled:opacity-30"
            >
              {chip}
            </button>
          ))}
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center gap-3 py-16">
          <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-accent)]/30 border-t-[var(--color-accent)]" />
          <p className="text-[13px] text-[var(--color-text-secondary)]">
            Generating queries and analyzing ChatGPT recommendations...
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-[var(--color-score-low)]/20 bg-[var(--color-score-low)]/[0.05] px-4 py-3 text-[13px] text-[var(--color-score-low)]">
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-8">
          {/* Top-level stats bar */}
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              label="Queries Tested"
              value={String(result.queries_tested)}
              note="Diverse customer queries sent to ChatGPT"
            />
            <StatCard
              label="Recommendation Rate"
              value={`${result.rec_rate}%`}
              note={`${result.queries_with_recs} of ${result.queries_tested} triggered product recommendations`}
              valueColor={
                result.rec_rate >= 70
                  ? "var(--color-score-high)"
                  : result.rec_rate >= 40
                    ? "var(--color-score-mid)"
                    : "var(--color-score-low)"
              }
            />
            <StatCard
              label="Your Brand Rank"
              value={
                !result.brand
                  ? "--"
                  : result.user_brand_rank
                    ? `#${result.user_brand_rank}`
                    : "Not found"
              }
              note={
                !result.brand
                  ? "No brand specified"
                  : result.user_brand_rank
                    ? `Out of ${result.brand_ranking.length} brands detected`
                    : "ChatGPT did not recommend your brand"
              }
              valueColor={
                !result.brand
                  ? undefined
                  : result.user_brand_rank
                    ? result.user_brand_rank <= 3
                      ? "var(--color-score-high)"
                      : "var(--color-score-mid)"
                    : "var(--color-score-low)"
              }
            />
          </div>

          {/* Brand Leaderboard */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-[12px] font-medium uppercase tracking-widest text-[var(--color-text-muted)]">
                Brand Leaderboard
              </h2>
              <span className="text-[12px] tabular-nums text-[var(--color-text-muted)]">
                {result.brand_ranking.length} brands detected
              </span>
            </div>

            {result.brand_ranking.length === 0 ? (
              <p className="py-4 text-center text-[13px] text-[var(--color-text-muted)]">
                No brands were detected in ChatGPT responses.
              </p>
            ) : (
              <div className="space-y-2">
                {result.brand_ranking.map((b, i) => {
                  const isUserBrand =
                    result.brand &&
                    b.name.toLowerCase().includes(result.brand.toLowerCase());
                  const barWidth = Math.max(8, (b.appearances / result.queries_tested) * 100);

                  return (
                    <div
                      key={b.name}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${
                        isUserBrand
                          ? "border border-[var(--color-accent)]/30 bg-[var(--color-accent-glow)]"
                          : "border border-transparent hover:bg-[var(--color-bg-card-hover)]"
                      }`}
                    >
                      {/* Rank */}
                      <span
                        className="w-7 shrink-0 text-right text-[14px] font-bold tabular-nums"
                        style={{
                          color: isUserBrand
                            ? "var(--color-accent-bright)"
                            : i === 0
                              ? "var(--color-score-high)"
                              : "var(--color-text-muted)",
                        }}
                      >
                        {i + 1}
                      </span>

                      {/* Brand name */}
                      <span
                        className={`w-36 shrink-0 truncate text-[13px] font-medium ${
                          isUserBrand
                            ? "text-[var(--color-accent-bright)]"
                            : "text-[var(--color-text-primary)]"
                        }`}
                      >
                        {b.name}
                        {isUserBrand && (
                          <span className="ml-1.5 text-[10px] font-normal uppercase tracking-widest text-[var(--color-accent)]">
                            you
                          </span>
                        )}
                      </span>

                      {/* Bar */}
                      <div className="flex-1">
                        <div className="h-6 w-full overflow-hidden rounded-md bg-white/[0.03]">
                          <div
                            className="flex h-full items-center rounded-md px-2.5 transition-all duration-700 ease-out"
                            style={{
                              width: `${barWidth}%`,
                              backgroundColor: isUserBrand
                                ? "rgba(59, 130, 246, 0.2)"
                                : i === 0
                                  ? "rgba(34, 197, 94, 0.15)"
                                  : "rgba(255, 255, 255, 0.04)",
                              borderLeft: `3px solid ${
                                isUserBrand
                                  ? "var(--color-accent)"
                                  : i === 0
                                    ? "var(--color-score-high)"
                                    : "var(--color-text-muted)"
                              }`,
                            }}
                          />
                        </div>
                      </div>

                      {/* Count */}
                      <span className="w-28 shrink-0 text-right text-[12px] tabular-nums text-[var(--color-text-secondary)]">
                        {b.appearances}/{result.queries_tested} queries
                        <span className="ml-1 text-[var(--color-text-muted)]">
                          ({b.share}%)
                        </span>
                      </span>
                    </div>
                  );
                })}

                {/* User brand not found banner */}
                {result.brand && !result.user_brand_rank && (
                  <div className="mt-3 flex items-center gap-3 rounded-lg border border-[var(--color-score-low)]/20 bg-[var(--color-score-low)]/[0.05] px-4 py-3">
                    <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-[var(--color-score-low)]" />
                    <span className="text-[13px] font-medium text-[var(--color-score-low)]">
                      YOUR BRAND NOT FOUND
                    </span>
                    <span className="text-[12px] text-[var(--color-text-muted)]">
                      &ldquo;{result.brand}&rdquo; was not recommended by ChatGPT in any of the {result.queries_tested} queries tested.
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Query-by-Query Results */}
          <div className="space-y-3">
            <h2 className="px-1 text-[12px] font-medium uppercase tracking-widest text-[var(--color-text-muted)]">
              Query-by-Query Results
            </h2>

            <div className="space-y-2">
              {result.results.map((r, i) => (
                <QueryCard
                  key={i}
                  result={r}
                  userBrand={result.brand}
                  queryIndex={i + 1}
                />
              ))}
            </div>
          </div>

          {/* What This Means */}
          <WhatThisMeans result={result} topBrandAppearances={topBrandAppearances} />
        </div>
      )}
    </div>
  );
}

/* ─── Sub-components ─── */

function StatCard({
  label,
  value,
  note,
  valueColor,
}: {
  label: string;
  value: string;
  note: string;
  valueColor?: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6">
      <p className="text-[10px] font-medium uppercase tracking-widest text-[var(--color-text-muted)]">
        {label}
      </p>
      <p
        className="mt-1.5 text-2xl font-bold tabular-nums tracking-tight"
        style={{ color: valueColor || "var(--color-text-primary)" }}
      >
        {value}
      </p>
      <p className="mt-0.5 text-[10px] text-[var(--color-text-muted)]">{note}</p>
    </div>
  );
}

function QueryCard({
  result,
  userBrand,
  queryIndex,
}: {
  result: QueryResult;
  userBrand: string | null;
  queryIndex: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const strength = STRENGTH_STYLES[result.recommendation_strength] || STRENGTH_STYLES.none;
  const brandInResult = userBrand
    ? result.brands.some((b) => b.toLowerCase().includes(userBrand.toLowerCase()))
    : false;

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] transition-colors hover:bg-[var(--color-bg-card-hover)]">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        {/* Query number */}
        <span className="w-6 shrink-0 text-center text-[12px] tabular-nums text-[var(--color-text-muted)]">
          {queryIndex}
        </span>

        {/* Query text */}
        <span className="flex-1 text-[13px] text-[var(--color-text-secondary)]">
          &ldquo;{result.query}&rdquo;
        </span>

        {/* Brand pills */}
        <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
          {result.brands.slice(0, 4).map((b) => {
            const isUser = userBrand && b.toLowerCase().includes(userBrand.toLowerCase());
            return (
              <span
                key={b}
                className="rounded-md px-2 py-0.5 text-[10px] font-medium"
                style={{
                  backgroundColor: isUser
                    ? "rgba(59, 130, 246, 0.15)"
                    : "rgba(255, 255, 255, 0.04)",
                  color: isUser ? "var(--color-accent-bright)" : "var(--color-text-muted)",
                  border: `1px solid ${isUser ? "rgba(59, 130, 246, 0.3)" : "var(--color-border)"}`,
                }}
              >
                {b}
              </span>
            );
          })}
          {result.brands.length > 4 && (
            <span className="text-[10px] text-[var(--color-text-muted)]">
              +{result.brands.length - 4}
            </span>
          )}
        </div>

        {/* Strength badge */}
        <span
          className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium"
          style={{
            backgroundColor: `${strength.bg}15`,
            color: strength.text,
            border: `1px solid ${strength.border}30`,
          }}
        >
          {strength.label}
        </span>

        {/* User brand indicator */}
        {userBrand && (
          <span
            className="inline-block h-2 w-2 shrink-0 rounded-full"
            style={{
              backgroundColor: brandInResult
                ? "var(--color-score-high)"
                : "var(--color-score-low)",
            }}
            title={brandInResult ? "Your brand was recommended" : "Your brand was not recommended"}
          />
        )}

        {/* Expand chevron */}
        <svg
          className={`h-4 w-4 shrink-0 text-[var(--color-text-muted)] transition-transform duration-200 ${
            expanded ? "rotate-180" : ""
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-[var(--color-border)]/50 px-4 py-3 space-y-3">
          {/* Brands found */}
          <div>
            <p className="text-[10px] font-medium uppercase tracking-widest text-[var(--color-text-muted)]">
              Brands Recommended
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {result.brands.length === 0 ? (
                <span className="text-[12px] text-[var(--color-text-muted)]">No brands detected</span>
              ) : (
                result.brands.map((b) => {
                  const isUser = userBrand && b.toLowerCase().includes(userBrand.toLowerCase());
                  return (
                    <span
                      key={b}
                      className="rounded-md px-2 py-1 text-[11px] font-medium"
                      style={{
                        backgroundColor: isUser
                          ? "rgba(59, 130, 246, 0.15)"
                          : "rgba(255, 255, 255, 0.04)",
                        color: isUser ? "var(--color-accent-bright)" : "var(--color-text-secondary)",
                        border: `1px solid ${isUser ? "rgba(59, 130, 246, 0.3)" : "var(--color-border)"}`,
                      }}
                    >
                      {b}
                    </span>
                  );
                })
              )}
            </div>
          </div>

          {/* Products found */}
          {result.products.length > 0 && (
            <div>
              <p className="text-[10px] font-medium uppercase tracking-widest text-[var(--color-text-muted)]">
                Specific Products
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {result.products.map((p) => (
                  <span
                    key={p}
                    className="rounded-md border border-[var(--color-border)] bg-white/[0.03] px-2 py-1 text-[11px] text-[var(--color-text-secondary)]"
                  >
                    {p}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Response preview */}
          <div>
            <p className="text-[10px] font-medium uppercase tracking-widest text-[var(--color-text-muted)]">
              Response Preview
            </p>
            <p className="mt-1.5 rounded-lg border border-[var(--color-border)]/50 bg-[var(--color-bg-secondary)] p-3 text-[12px] leading-relaxed text-[var(--color-text-muted)]">
              {result.response_preview}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function WhatThisMeans({
  result,
  topBrandAppearances,
}: {
  result: CompetitiveResult;
  topBrandAppearances: number;
}) {
  if (!result.brand) return null;

  const brandName = result.brand;
  const userRank = result.user_brand_rank;
  const userAppearances = result.user_brand_appearances;
  const totalQueries = result.queries_tested;
  const topCompetitor = result.brand_ranking.length > 0 ? result.brand_ranking[0] : null;

  let borderColor: string;
  let bgColor: string;
  let iconColor: string;
  let title: string;
  let body: string;

  if (!userRank) {
    // Brand not found at all
    borderColor = "var(--color-score-low)";
    bgColor = "rgba(239, 68, 68, 0.04)";
    iconColor = "var(--color-score-low)";
    title = "Your Brand Is Invisible";
    body = `ChatGPT does not recommend ${brandName} for any of these queries. Your competitors are capturing this traffic. Use the Page Auditor and Unsolicited Rec Optimizer to fix your content.`;
  } else if (userRank === 1) {
    // Brand is #1
    borderColor = "var(--color-score-high)";
    bgColor = "rgba(34, 197, 94, 0.04)";
    iconColor = "var(--color-score-high)";
    title = "Category Leader";
    body = `${brandName} leads this category in AI recommendations. Appearing in ${userAppearances}/${totalQueries} queries, you have the strongest visibility in ChatGPT's product suggestions.`;
  } else {
    // Brand found but not #1
    borderColor = "var(--color-score-mid)";
    bgColor = "rgba(234, 179, 8, 0.04)";
    iconColor = "var(--color-score-mid)";
    title = "Room to Grow";
    body = `${brandName} appears in ${userAppearances}/${totalQueries} queries.${
      topCompetitor
        ? ` Top competitor (${topCompetitor.name}) appears in ${topBrandAppearances}/${totalQueries}.`
        : ""
    } Close the gap by targeting the queries where you're missing.`;
  }

  return (
    <div
      className="rounded-xl p-6 space-y-3"
      style={{
        border: `1px solid ${borderColor}20`,
        backgroundColor: bgColor,
      }}
    >
      <div className="flex items-center gap-2">
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ backgroundColor: iconColor }}
        />
        <h2
          className="text-[12px] font-medium uppercase tracking-widest"
          style={{ color: iconColor }}
        >
          {title}
        </h2>
      </div>
      <p className="text-[13px] leading-relaxed text-[var(--color-text-secondary)]">{body}</p>
    </div>
  );
}
