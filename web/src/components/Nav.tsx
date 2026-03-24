"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const primaryLinks = [
  { href: "/reverse-engineer", label: "Why They Win" },
  { href: "/social", label: "Social Optimizer" },
  { href: "/validate", label: "Query Tester" },
];

const secondaryLinks = [
  { href: "/", label: "Page Audit" },
  { href: "/unsolicited", label: "Unsolicited Recs" },
  { href: "/co-citation", label: "Co-Citation" },
];

export default function Nav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <nav className="border-b border-[var(--color-border)]">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--color-accent)]">
            <span className="text-xs font-bold text-white">A</span>
          </div>
          <span className="text-[15px] font-semibold tracking-tight text-[var(--color-text-primary)]">
            AEO Intelligence
          </span>
        </Link>
        <div className="flex items-center gap-1">
          {primaryLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors duration-200 ${
                pathname === l.href
                  ? "bg-white/[0.08] text-white"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
              }`}
            >
              {l.label}
            </Link>
          ))}
          <div className="relative">
            <button
              onClick={() => setMoreOpen(!moreOpen)}
              className={`rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors duration-200 ${
                secondaryLinks.some((l) => pathname === l.href)
                  ? "bg-white/[0.08] text-white"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
              }`}
            >
              More
              <svg className="ml-1 inline-block h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {moreOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMoreOpen(false)} />
                <div className="absolute right-0 z-20 mt-1 w-44 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] py-1 shadow-lg">
                  {secondaryLinks.map((l) => (
                    <Link
                      key={l.href}
                      href={l.href}
                      onClick={() => setMoreOpen(false)}
                      className={`block px-4 py-2 text-[13px] transition-colors ${
                        pathname === l.href
                          ? "text-white bg-white/[0.06]"
                          : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-white/[0.03]"
                      }`}
                    >
                      {l.label}
                    </Link>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
