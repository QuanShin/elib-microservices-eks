import { useEffect, useMemo, useState } from "react";
import { listBooks, type BookListItem } from "../lib/catalogApi";

type Props = {
  onSelect: (id: number) => void;
};

function coverStyle(seed: string) {
  const palettes = [
    ["#60a5fa", "#2563eb"],
    ["#f59e0b", "#ef4444"],
    ["#34d399", "#059669"],
    ["#a78bfa", "#7c3aed"],
    ["#f472b6", "#db2777"],
    ["#22d3ee", "#0891b2"]
  ];

  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = seed.charCodeAt(i) + ((h << 5) - h);
  const pair = palettes[Math.abs(h) % palettes.length];

  return {
    background: `linear-gradient(160deg, ${pair[0]}, ${pair[1]})`
  };
}

function BookCover({ title, category }: { title: string; category: string }) {
  return (
    <div
      className="bookThumb"
      style={coverStyle(`${title}-${category}`)}
      aria-label={`${title} cover`}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 10,
          color: "white"
        }}
      >
        <div
          style={{
            alignSelf: "flex-start",
            padding: "4px 8px",
            borderRadius: 999,
            background: "rgba(255,255,255,.16)",
            border: "1px solid rgba(255,255,255,.18)",
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: ".04em",
            textTransform: "uppercase",
            backdropFilter: "blur(4px)"
          }}
        >
          {category}
        </div>

        <div
          style={{
            fontSize: 13,
            fontWeight: 900,
            lineHeight: 1.05,
            letterSpacing: "-.02em",
            textShadow: "0 6px 18px rgba(0,0,0,.22)",
            wordBreak: "break-word"
          }}
        >
          {title}
        </div>
      </div>
    </div>
  );
}

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
              <BookCover title={b.title} category={b.category} />

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