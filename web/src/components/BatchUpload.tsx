"use client";

import { useState, useCallback } from "react";
import { batchRewrite } from "@/lib/api";

export default function BatchUpload() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback(async (file: File) => {
    setLoading(true);
    setError("");
    setSuccess(false);
    try {
      const blob = await batchRewrite(file);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "reprompt_results.csv";
      a.click();
      URL.revokeObjectURL(url);
      setSuccess(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => {
          const input = document.createElement("input");
          input.type = "file";
          input.accept = ".csv";
          input.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) handleFile(file);
          };
          input.click();
        }}
        className={`flex min-h-[180px] cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed transition-all duration-200 ${
          dragOver
            ? "border-[var(--color-accent)] bg-[var(--color-accent-glow)]"
            : "border-[var(--color-border)] bg-[var(--color-bg-card)] hover:border-[var(--color-text-muted)]/30"
        }`}
      >
        {loading ? (
          <div className="flex flex-col items-center gap-3">
            <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-accent)]/30 border-t-[var(--color-accent)]" />
            <p className="text-[13px] text-[var(--color-text-secondary)]">Processing queries...</p>
          </div>
        ) : (
          <>
            <svg className="mb-2 h-8 w-8 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            <p className="text-[13px] text-[var(--color-text-secondary)]">
              Drop a CSV file or click to upload
            </p>
            <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">
              CSV must have a &quot;query&quot; column
            </p>
          </>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-[var(--color-score-low)]/20 bg-[var(--color-score-low)]/[0.05] px-4 py-3 text-[13px] text-[var(--color-score-low)]">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg border border-[var(--color-score-high)]/20 bg-[var(--color-score-high)]/[0.05] px-4 py-3 text-[13px] text-[var(--color-score-high)]">
          Download started — check your downloads folder.
        </div>
      )}
    </div>
  );
}
