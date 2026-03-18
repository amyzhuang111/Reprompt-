export default function CategoryTags({ categories }: { categories: string[] }) {
  if (!categories.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {categories.map((cat) => (
        <span
          key={cat}
          className="rounded bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-[var(--color-text-muted)]"
        >
          {cat}
        </span>
      ))}
    </div>
  );
}
