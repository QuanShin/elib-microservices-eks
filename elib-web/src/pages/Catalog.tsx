import { useEffect, useMemo, useState } from "react";
import { listBooks, type BookListItem } from "../lib/catalogApi";
import BookCover from "../components/BookCover";

type Props = {
  onSelect: (id: number) => void;
};

type SortMode = "featured" | "title" | "year-desc" | "year-asc";

export default function Catalog({ onSelect }: Props) {
  const [books, setBooks] = useState<BookListItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("ALL");
  const [sortBy, setSortBy] = useState<SortMode>("featured");

  async function load() {
    setErr(null);
    setBusy(true);
    try {
      const data = await listBooks();
      setBooks(data);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load books");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const categories = useMemo(() => {
    const set = new Set(books.map((b) => b.category));
    return ["ALL", ...Array.from(set).sort()];
  }, [books]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    const result = books.filter((b: any) => {
      const matchQ =
        !q ||
        b.title.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q) ||
        b.category.toLowerCase().includes(q) ||
        (b.description ?? "").toLowerCase().includes(q);

      const matchC = category === "ALL" || b.category === category;
      return matchQ && matchC;
    });

    result.sort((a: any, b: any) => {
      if (sortBy === "year-desc") return b.year - a.year;
      if (sortBy === "year-asc") return a.year - b.year;
      if (sortBy === "title") return a.title.localeCompare(b.title);

      const aScore =
        (a.coverImageUrl ? 2 : 0) +
        (a.description ? 1 : 0) +
        Math.min(1, (a.title?.length ?? 0) / 100);

      const bScore =
        (b.coverImageUrl ? 2 : 0) +
        (b.description ? 1 : 0) +
        Math.min(1, (b.title?.length ?? 0) / 100);

      return bScore - aScore;
    });

    return result;
  }, [books, query, category, sortBy]);

  return (
    <div className="surfaceCard luxuryCatalogShell">
      <div className="luxuryCatalogHero">
        <div className="luxuryCatalogIntro">
          <div className="eyebrowTag">Editorial Selection</div>
          <div className="sectionTitle luxuryCatalogTitle">Library Collection</div>
          <div className="sectionSubtitle luxuryCatalogSubtitle">
            Discover curated titles, refined by category, author, and relevance.
            Browse the collection in a cleaner, premium reading-first experience.
          </div>
        </div>

        <button
          className="btn secondary"
          style={{ marginTop: 0, width: "auto", padding: "10px 14px" }}
          onClick={load}
          disabled={busy}
          type="button"
        >
          {busy ? "Refreshing…" : "Reload"}
        </button>
      </div>

      <div className="luxuryCatalogFilters">
        <div className="luxurySearchBlock">
          <label>Search</label>
          <input
            placeholder="Search by title, author, description, or category…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div>
          <label>Category</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label>Sort</label>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortMode)}>
            <option value="featured">Featured</option>
            <option value="title">Title</option>
            <option value="year-desc">Newest</option>
            <option value="year-asc">Oldest</option>
          </select>
        </div>
      </div>

      <div className="luxuryCatalogToolbar">
        <div className="muted small">
          {busy ? "Refreshing collection…" : `${filtered.length} result${filtered.length === 1 ? "" : "s"} found`}
        </div>

        {(query || category !== "ALL" || sortBy !== "featured") && (
          <button
            className="btn secondary"
            style={{ marginTop: 0, width: "auto", padding: "8px 12px" }}
            type="button"
            onClick={() => {
              setQuery("");
              setCategory("ALL");
              setSortBy("featured");
            }}
          >
            Clear filters
          </button>
        )}
      </div>

      {err && <div className="msg error">{err}</div>}

      <div className="luxuryCatalogGrid">
        {filtered.map((b: any) => {
          const snippet =
            (b.description?.trim() ||
              "Open this title to view its full details, sample reading section, and related recommendations.")
              .replace(/\s+/g, " ")
              .slice(0, 105);

          return (
            <button
              key={b.id}
              className="luxuryBookCard"
              onClick={() => onSelect(b.id)}
              type="button"
            >
              <div className="luxuryBookCardInner">
                <div className="luxuryBookCoverCol">
                  <BookCover
                    title={b.title}
                    category={b.category}
                    className="bookThumb"
                    coverImageUrl={(b as any).coverImageUrl}
                  />
                </div>

                <div className="luxuryBookContent">
                  <div className="luxuryBookTop">
                    <div className="bookTitle luxuryBookTitle">{b.title}</div>
                    <div className="luxuryBookAuthor">{b.author}</div>
                  </div>

                  <div className="bookDetailsMeta luxuryMetaRow">
                    <span className="metaTag">{b.category}</span>
                    <span className="metaTag">{b.year}</span>
                  </div>

                  <div className="luxuryBookDescription">
                    {snippet}
                    {(b.description?.trim()?.length ?? 0) > 105 ? "…" : ""}
                  </div>

                  <div className="luxuryBookFooter">
                    <span className="luxuryActionHint">View details</span>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {!busy && filtered.length === 0 && (
        <div className="surfaceCard luxuryEmptyState">
          <div className="sectionTitle" style={{ fontSize: "1rem" }}>
            No matches found
          </div>
          <div className="sectionSubtitle">
            Try a different title, author, or category filter.
          </div>
        </div>
      )}
    </div>
  );
}