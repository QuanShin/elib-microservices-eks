import { useState } from "react";
import { createBook, type BookCreate } from "../lib/catalogApi";
import BookCover from "../components/BookCover";

export default function AddBook({ onCreated }: { onCreated: () => void }) {
  const [form, setForm] = useState<BookCreate>({
    title: "",
    author: "",
    category: "Software",
    year: new Date().getFullYear(),
    description: "",
    isbn: ""
  });

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  function set<K extends keyof BookCreate>(key: K, val: BookCreate[K]) {
    setForm((prev) => ({ ...prev, [key]: val }));
  }

  async function submit() {
    setErr(null);
    setOk(null);

    if (!form.title.trim()) return setErr("Title is required.");
    if (!form.author.trim()) return setErr("Author is required.");
    if (!form.category.trim()) return setErr("Category is required.");
    if (!form.year || form.year < 0) return setErr("Year is invalid.");

    setBusy(true);
    try {
      await createBook({
        title: form.title.trim(),
        author: form.author.trim(),
        category: form.category.trim(),
        year: Number(form.year),
        description: form.description?.trim() || undefined,
        isbn: form.isbn?.trim() || undefined
      });
      setOk("Book created ✅");
      setTimeout(() => onCreated(), 700);
    } catch (e: any) {
      setErr(e?.message ?? "Create failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1.15fr 0.85fr",
        gap: 18
      }}
    >
      <div className="surfaceCard">
        <div className="sectionTitle">Add a New Book</div>
        <div className="sectionSubtitle">
          Create a new catalog entry with metadata, description, and a live visual preview.
        </div>

        <label>Title</label>
        <input
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="Enter book title"
        />

        <label>Author</label>
        <input
          value={form.author}
          onChange={(e) => set("author", e.target.value)}
          placeholder="Enter author name"
        />

        <label>Category</label>
        <input
          value={form.category}
          onChange={(e) => set("category", e.target.value)}
          placeholder="Enter category"
        />

        <label>Year</label>
        <input
          type="number"
          value={form.year}
          onChange={(e) => set("year", Number(e.target.value))}
          placeholder="Enter publish year"
        />

        <label>ISBN (optional)</label>
        <input
          value={form.isbn ?? ""}
          onChange={(e) => set("isbn", e.target.value)}
          placeholder="Enter ISBN"
        />

        <label>Description (optional)</label>
        <textarea
          value={form.description ?? ""}
          onChange={(e) => set("description", e.target.value)}
          rows={6}
          placeholder="Write a short description for this title"
        />

        <div className="bookActionRow" style={{ marginTop: 18 }}>
          <button className="btn primary" disabled={busy} onClick={submit} type="button">
            {busy ? "Creating…" : "Create Book"}
          </button>
        </div>

        {err && <div className="msg error">{err}</div>}
        {ok && <div className="msg ok">{ok}</div>}

        <div className="muted small" style={{ marginTop: 12 }}>
          This route should remain admin-only and return 403 for non-admin users.
        </div>
      </div>

      <div className="surfaceCard">
        <div className="sectionTitle">Live Preview</div>
        <div className="sectionSubtitle">
          Preview how the book will appear in the modern library interface.
        </div>

        <div
          style={{
            marginTop: 18,
            display: "grid",
            justifyItems: "center",
            gap: 16
          }}
        >
          <div style={{ width: "min(240px, 100%)" }}>
            <BookCover
              title={form.title || "New Book"}
              category={form.category || "Catalog"}
              className="bookDetailsCover"
            />
          </div>

          <div style={{ width: "100%", textAlign: "left" }}>
            <div className="bookDetailsTitle" style={{ fontSize: "1.6rem", marginBottom: 10 }}>
              {form.title || "New Book"}
            </div>

            <div className="bookDetailsMeta">
              <span className="metaTag">{form.author || "Author name"}</span>
              <span className="metaTag">{form.category || "Category"}</span>
              <span className="metaTag">{form.year}</span>
              {form.isbn ? <span className="metaTag">ISBN {form.isbn}</span> : null}
            </div>

            <div className="loanStateCard" style={{ marginTop: 16 }}>
              <div className="loanStateTitle">Preview summary</div>
              <div className="loanStateText">
                This card reflects the visual style used across the catalog and book details views.
              </div>
            </div>

            {form.description ? (
              <div className="bookDetailsDesc" style={{ marginTop: 14 }}>
                {form.description}
              </div>
            ) : (
              <div className="bookDetailsDesc" style={{ marginTop: 14 }}>
                Add a short description to make the title more informative and visually complete.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}