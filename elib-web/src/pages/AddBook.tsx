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
    <section className="page-section form-layout">
      <div className="form-card">
        <div className="section-kicker">Admin</div>
        <h3>Add a new book</h3>

        <label>Title</label>
        <input value={form.title} onChange={(e) => set("title", e.target.value)} />

        <label>Author</label>
        <input value={form.author} onChange={(e) => set("author", e.target.value)} />

        <label>Category</label>
        <input value={form.category} onChange={(e) => set("category", e.target.value)} />

        <label>Year</label>
        <input type="number" value={form.year} onChange={(e) => set("year", Number(e.target.value))} />

        <label>ISBN (optional)</label>
        <input value={form.isbn ?? ""} onChange={(e) => set("isbn", e.target.value)} />

        <label>Description (optional)</label>
        <textarea value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} rows={5} />

        <button className="btn primary" disabled={busy} onClick={submit} type="button">
          {busy ? "Creating…" : "Create Book"}
        </button>

        {err && <div className="msg error">{err}</div>}
        {ok && <div className="msg ok">{ok}</div>}

        <div className="muted small" style={{ marginTop: 10 }}>
          This route should stay admin-only and return 403 for non-admin users.
        </div>
      </div>

      <div className="preview-card">
        <div className="section-kicker">Preview</div>
        <h3>Cover mockup</h3>
        <BookCover title={form.title || "New Book"} category={form.category || "Catalog"} className="book-cover--large" />
        <div className="bookTitle" style={{ marginTop: 16 }}>{form.title || "New Book"}</div>
        <div className="muted small">{form.author || "Author name"} • {form.category || "Category"} • {form.year}</div>
        {form.description && <p className="muted small" style={{ marginTop: 10 }}>{form.description}</p>}
      </div>
    </section>
  );
}