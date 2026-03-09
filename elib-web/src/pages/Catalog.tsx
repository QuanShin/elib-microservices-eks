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
      const matchQ = !q || b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q);
      const matchC = category === "ALL" || b.category === category;
      return matchQ && matchC;
    });
  }, [books, query, category]);

  return (
    <div className="panel">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
        <div style={{ fontWeight: 900, fontSize: 18 }}>Catalog</div>
        <button
          className="btn secondary"
          style={{ marginTop: 0, width: "auto", padding: "10px 12px" }}
          onClick={load}
          disabled={busy}
          type="button"
        >
          {busy ? "Loading…" : "Reload"}
        </button>
      </div>

      <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
        <input
          placeholder="Search by title or author…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {err && <div className="msg error">{err}</div>}

      <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
        {filtered.map((b) => (
          <button key={b.id} className="bookCard" onClick={() => onSelect(b.id)} type="button">
            <div className="bookCardRow">
              <div className="bookThumb" style={coverStyle(`${b.title}-${b.category}`)} />
              <div>
                <div className="bookTitle">{b.title}</div>
                <div className="muted small">{b.author}</div>
                <div className="muted small">{b.category} • {b.year}</div>
              </div>
            </div>
          </button>
        ))}
      </div>

      {!busy && filtered.length === 0 && (
        <div className="muted small" style={{ marginTop: 10 }}>No matches.</div>
      )}
    </div>
  );
}