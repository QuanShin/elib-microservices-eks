import { useEffect, useMemo, useState } from "react";
import { listBooks, type BookListItem } from "../lib/catalogApi";
import BookCover from "../components/BookCover";

type Props = {
  onSelect: (id: number) => void;
};

type SortMode = "title" | "year-desc" | "year-asc";

export default function Catalog({ onSelect }: Props) {
  const [books, setBooks] = useState<BookListItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("ALL");
  const [sortBy, setSortBy] = useState<SortMode>("title");

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

    const result = books.filter((b) => {
      const matchQ =
        !q ||
        b.title.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q) ||
        b.category.toLowerCase().includes(q);

      const matchC = category === "ALL" || b.category === category;
      return matchQ && matchC;
    });

    result.sort((a, b) => {
      if (sortBy === "year-desc") return b.year - a.year;
      if (sortBy === "year-asc") return a.year - b.year;
      return a.title.localeCompare(b.title);
    });

    return result;
  }, [books, query, category, sortBy]);

  return (
    <div className="surfaceCard catalogSurface premiumCatalog">
      <div className="catalogHero">
        <div>
          <div className="eyebrowTag">Curated Collection</div>
          <div className="sectionTitle">Discover Books</div>
          <div className="sectionSubtitle">
            Explore a premium digital collection with elegant search, genre discovery, and detailed reading previews.
          </div>
        </div>

        <button
          className="btn secondary"
          style={{ marginTop: 0, width: "auto", padding: "10px 14px" }}
          onClick={load}
          disabled={busy}
          type="button"
        >
          {busy ? "Loading…" : "Reload"}
        </button>
      </div>

      <div className="catalogFilters">
        <div className="catalogSearchWrap">
          <label>Search</label>
          <input
            placeholder="Search by title, author, or genre…"
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
          <label>Sort by</label>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortMode)}>
            <option value="title">Title</option>
            <option value="year-desc">Newest</option>
            <option value="year-asc">Oldest</option>
          </select>
        </div>
      </div>

      <div className="catalogToolbar">
        <div className="muted small">
          {busy ? "Loading library…" : `${filtered.length} result${filtered.length === 1 ? "" : "s"} found`}
        </div>

        {(query || category !== "ALL" || sortBy !== "title") && (
          <button
            className="btn secondary"
            style={{ marginTop: 0, width: "auto", padding: "8px 12px" }}
            type="button"
            onClick={() => {
              setQuery("");
              setCategory("ALL");
              setSortBy("title");
            }}
          >
            Clear filters
          </button>
        )}
      </div>

      {err && <div className="msg error">{err}</div>}

      <div className="catalogGrid premiumCatalogGrid">
        {filtered.map((b: any) => (
          <button
            key={b.id}
            className="bookCard premiumBookCard"
            onClick={() => onSelect(b.id)}
            type="button"
          >
            <div className="premiumBookRow">
              <BookCover
                title={b.title}
                category={b.category}
                className="bookThumb premiumThumb"
                coverImageUrl={b.coverImageUrl}
              />

              <div className="premiumBookBody">
                <div className="premiumBookTop">
                  <div className="bookTitle premiumBookTitle">{b.title}</div>
                  <div className="muted small premiumAuthor">{b.author}</div>
                </div>

                <div className="bookDetailsMeta premiumMetaRow">
                  <span className="metaTag">{b.category}</span>
                  <span className="metaTag">{b.year}</span>
                </div>

                <div className="premiumBookSnippet">
                  {(b.description?.trim() || "Open this book to explore details, reading preview, and related recommendations.").slice(0, 140)}
                  {(b.description?.trim()?.length ?? 0) > 140 ? "…" : ""}
                </div>

                <div className="premiumBookFooter">
                  <span className="catalogActionHint">View details</span>
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>

      {!busy && filtered.length === 0 && (
        <div className="surfaceCard emptyStateCard" style={{ marginTop: 16 }}>
          <div className="sectionTitle" style={{ fontSize: "1rem" }}>
            No matches found
          </div>
          <div className="sectionSubtitle">
            Try another title, author, category, or sorting option.
          </div>
        </div>
      )}
    </div>
  );
}