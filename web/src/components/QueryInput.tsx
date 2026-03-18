"use client";

import { useState } from "react";

interface QueryInputProps {
  onSubmit: (query: string) => void;
  loading: boolean;
}

export default function QueryInput({ onSubmit, loading }: QueryInputProps) {
  const [query, setQuery] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim() && !loading) onSubmit(query.trim());
  };

  return (
    <form onSubmit={handleSubmit} className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Enter a customer query..."
        className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-3.5 pr-24 text-[14px] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] outline-none transition-all duration-200 focus:border-[var(--color-accent)]/40 focus:shadow-[0_0_0_1px_rgba(59,130,246,0.15)]"
        disabled={loading}
      />
      <button
        type="submit"
        disabled={loading || !query.trim()}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md bg-[var(--color-accent)] px-4 py-2 text-[13px] font-medium text-white transition-all duration-200 hover:opacity-90 active:scale-[0.97] disabled:opacity-30"
      >
        {loading ? (
          <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
        ) : (
          "Rewrite"
        )}
      </button>
    </form>
  );
}
