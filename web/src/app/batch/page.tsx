"use client";

import BatchUpload from "@/components/BatchUpload";

export default function BatchPage() {
  return (
    <div className="space-y-10">
      <div className="glow-blue pt-4 text-center">
        <h1 className="text-[28px] font-semibold tracking-tight text-[var(--color-text-primary)]">
          Batch Rewrite
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-[var(--color-text-secondary)]">
          Upload a CSV of customer queries and download scored rewrites
        </p>
      </div>

      <div className="mx-auto max-w-xl">
        <BatchUpload />
      </div>

      <div className="mx-auto max-w-xl rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5">
        <h3 className="text-[12px] font-medium uppercase tracking-widest text-[var(--color-text-muted)]">
          Expected CSV format
        </h3>
        <pre className="mt-3 overflow-x-auto rounded bg-[var(--color-bg-primary)] px-4 py-3 text-[12px] leading-relaxed text-[var(--color-text-secondary)]">
{`query
I've been having trouble sleeping lately
what's a good price for a couch?
credit card tips
how do I organize my home office?`}
        </pre>
        <p className="mt-3 text-[12px] text-[var(--color-text-muted)]">
          Output CSV includes: original query, original score, best rewrite, best score, strategy, and lift.
        </p>
      </div>
    </div>
  );
}
