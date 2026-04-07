import { useEffect, useMemo, useState } from "react";
import { listBooks, type BookListItem } from "../lib/catalogApi";
import BookCover from "../components/BookCover";

type Props = {
  onSelect: (id: number) => void;
};


export default function Catalog({ onSelect }: Props) {
  const [books, setBooks] = useState<BookListItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("ALL");

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
    return books.filter((b) => {
      const matchQ =
        !q ||
        b.title.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q);

      const matchC = category === "ALL" || b.category === category;
      return matchQ && matchC;
    });
  }, [books, query, category]);

  return (
    <div className="surfaceCard">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
          flexWrap: "wrap"
        }}
      >
        <div>
          <div className="sectionTitle">Discover Books</div>
          <div className="sectionSubtitle">
            Browse the library collection, filter by category, and open any title for full details.
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

      <div className="grid2" style={{ marginTop: 16 }}>
        <div>
          <label>Search</label>
          <input
            placeholder="Search by title or author…"
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
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          marginTop: 14,
          flexWrap: "wrap"
        }}
      >
        <div className="muted small">
          {busy ? "Loading library…" : `${filtered.length} result${filtered.length === 1 ? "" : "s"} found`}
        </div>

        {(query || category !== "ALL") && (
          <button
            className="btn secondary"
            style={{ marginTop: 0, width: "auto", padding: "8px 12px" }}
            type="button"
            onClick={() => {
              setQuery("");
              setCategory("ALL");
            }}
          >
            Clear filters
          </button>
        )}
      </div>

      {err && <div className="msg error">{err}</div>}

      <div className="catalogGrid" style={{ marginTop: 16 }}>
        {filtered.map((b) => (
          <button
            key={b.id}
            className="bookCard"
            onClick={() => onSelect(b.id)}
            type="button"
          >
            <div className="bookCardRow">
              <BookCover title={b.title} category={b.category} className="bookThumb" />

              <div style={{ minWidth: 0 }}>
                <div className="bookTitle">{b.title}</div>
                <div className="muted small">{b.author}</div>

                <div className="bookDetailsMeta" style={{ marginTop: 10 }}>
                  <span className="metaTag">{b.category}</span>
                  <span className="metaTag">{b.year}</span>
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>

      {!busy && filtered.length === 0 && (
        <div
          className="surfaceCard"
          style={{
            marginTop: 16,
            textAlign: "center",
            background: "rgba(255,255,255,.68)"
          }}
        >
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