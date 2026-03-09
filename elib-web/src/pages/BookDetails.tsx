import { useEffect, useMemo, useState } from "react";
import { getBook, updateBook, deleteBook, type Book, type BookCreate } from "../lib/catalogApi";
import { checkoutBook, returnBook, myLoans, type Loan } from "../lib/borrowApi";

function fmt(dt?: string | null) {
  if (!dt) return "";
  try {
    return new Date(dt).toLocaleString();
  } catch {
    return dt;
  }
}

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

export default function BookDetails({
  id,
  role,
  onBack,
  onChanged
}: {
  id: number;
  role: string;
  onBack: () => void;
  onChanged: () => void;
}) {
  const [book, setBook] = useState<Book | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [edit, setEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [loans, setLoans] = useState<Loan[] | null>(null);
  const [loanBusy, setLoanBusy] = useState(false);

  const [form, setForm] = useState<BookCreate>({
    title: "",
    author: "",
    category: "",
    year: new Date().getFullYear(),
    isbn: "",
    description: ""
  });

  const isAdmin = role === "ADMIN";

  const activeLoanForThisBook = useMemo(() => {
    if (!loans) return null;
    return loans.find((l) => l.bookId === id && !l.returnedAtUtc) ?? null;
  }, [loans, id]);

  async function loadBook() {
    setBusy(true);
    setErr(null);
    try {
      const b = await getBook(id);
      setBook(b);
      setForm({
        title: b.title,
        author: b.author,
        category: b.category,
        year: b.year,
        isbn: b.isbn ?? "",
        description: b.description ?? ""
      });
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load book");
    } finally {
      setBusy(false);
    }
  }

  async function loadLoans() {
    setLoanBusy(true);
    try {
      const data = await myLoans();
      setLoans(data);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load loans");
    } finally {
      setLoanBusy(false);
    }
  }

  useEffect(() => {
    setOk(null);
    setErr(null);
    setEdit(false);
    setShowDelete(false);
    setLoans(null);
    loadBook();
    loadLoans();
  }, [id]);

  async function onSave() {
    setErr(null);
    setOk(null);

    if (!form.title.trim()) return setErr("Title is required.");
    if (!form.author.trim()) return setErr("Author is required.");
    if (!form.category.trim()) return setErr("Category is required.");
    if (!form.year || form.year < 0) return setErr("Year is invalid.");

    setBusy(true);
    try {
      const updated = await updateBook(id, {
        title: form.title.trim(),
        author: form.author.trim(),
        category: form.category.trim(),
        year: Number(form.year),
        isbn: form.isbn?.trim() || undefined,
        description: form.description?.trim() || undefined
      });
      setBook(updated);
      setEdit(false);
      onChanged();
      setOk("Saved ✅");
      setTimeout(() => setOk(null), 1500);
    } catch (e: any) {
      setErr(e?.message ?? "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function onDeleteConfirm() {
    setBusy(true);
    setErr(null);
    setOk(null);
    try {
      await deleteBook(id);
      setShowDelete(false);
      onChanged();
      onBack();
    } catch (e: any) {
      setErr(e?.message ?? "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  async function onBorrow() {
    setErr(null);
    setOk(null);
    setLoanBusy(true);
    try {
      await checkoutBook(id);
      await loadLoans();
      onChanged();
      setOk("Borrowed ✅");
      setTimeout(() => setOk(null), 1500);
    } catch (e: any) {
      setErr(e?.message ?? "Borrow failed");
    } finally {
      setLoanBusy(false);
    }
  }

  async function onReturn() {
    setErr(null);
    setOk(null);
    setLoanBusy(true);
    try {
      await returnBook(id);
      await loadLoans();
      onChanged();
      setOk("Returned ✅");
      setTimeout(() => setOk(null), 1500);
    } catch (e: any) {
      setErr(e?.message ?? "Return failed");
    } finally {
      setLoanBusy(false);
    }
  }

  return (
    <div className="panel">
      <div className="toolbar">
        <button className="btn secondary" style={{ marginTop: 0 }} onClick={onBack} type="button">
          ← Back
        </button>

        {isAdmin && !edit && (
          <>
            <button className="btn secondary" style={{ marginTop: 0 }} onClick={() => setEdit(true)} disabled={busy || loanBusy} type="button">
              Edit
            </button>
            <button className="btn danger" style={{ marginTop: 0 }} onClick={() => setShowDelete(true)} disabled={busy || loanBusy} type="button">
              Delete
            </button>
          </>
        )}
      </div>

      {(busy || loanBusy) && <div className="muted">Loading…</div>}
      {err && <div className="msg error">{err}</div>}
      {ok && <div className="msg ok">{ok}</div>}

      {book && !edit && (
        <div style={{ marginTop: 12, display: "grid", gap: 14 }}>
          <div className="bookCardRow">
            <div className="bookThumb" style={{ ...coverStyle(`${book.title}-${book.category}`), height: 180, width: 130 }} />
            <div>
              <div style={{ fontWeight: 1000, fontSize: 22 }}>{book.title}</div>
              <div className="muted small">{book.author} • {book.category} • {book.year}</div>
              {book.isbn && <div className="muted small">ISBN: {book.isbn}</div>}
            </div>
          </div>

          {book.description && (
            <div
              style={{
                padding: 12,
                borderRadius: 16,
                border: "1px solid var(--line)",
                background: "#fff"
              }}
            >
              <div style={{ fontWeight: 900, marginBottom: 6 }}>Description</div>
              <div className="muted" style={{ marginTop: 0 }}>{book.description}</div>
            </div>
          )}

          <div
            style={{
              padding: 12,
              borderRadius: 16,
              border: "1px solid var(--line)",
              background: "#fff"
            }}
          >
            {!activeLoanForThisBook ? (
              <>
                <div style={{ fontWeight: 900 }}>Available</div>
                <div className="muted small">You do not have this book borrowed right now.</div>
                <button className="btn primary" onClick={onBorrow} disabled={busy || loanBusy} type="button">
                  Borrow this book
                </button>
              </>
            ) : (
              <>
                <div style={{ fontWeight: 900 }}>Currently borrowed</div>
                <div className="muted small">Borrowed: {fmt(activeLoanForThisBook.borrowedAtUtc)}</div>
                <div className="muted small">Due: {fmt(activeLoanForThisBook.dueAtUtc)}</div>
                <button className="btn secondary" onClick={onReturn} disabled={busy || loanBusy} type="button">
                  Return this book
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {book && edit && (
        <div style={{ marginTop: 12 }}>
          <label>Title</label>
          <input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />

          <label>Author</label>
          <input value={form.author} onChange={(e) => setForm((p) => ({ ...p, author: e.target.value }))} />

          <label>Category</label>
          <input value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} />

          <label>Year</label>
          <input type="number" value={form.year} onChange={(e) => setForm((p) => ({ ...p, year: Number(e.target.value) }))} />

          <label>ISBN</label>
          <input value={form.isbn ?? ""} onChange={(e) => setForm((p) => ({ ...p, isbn: e.target.value }))} />

          <label>Description</label>
          <textarea
            rows={5}
            value={form.description ?? ""}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
          />

          <div className="grid2">
            <button className="btn primary" onClick={onSave} disabled={busy} type="button">
              Save
            </button>
            <button className="btn secondary" onClick={() => setEdit(false)} disabled={busy} type="button">
              Cancel
            </button>
          </div>
        </div>
      )}

      {showDelete && (
        <div className="modalOverlay" onClick={() => setShowDelete(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ fontWeight: 900, fontSize: 18 }}>Delete book?</div>
            <p className="muted">This action cannot be undone.</p>
            <div className="grid2">
              <button className="btn danger" onClick={onDeleteConfirm} disabled={busy} type="button">
                Delete
              </button>
              <button className="btn secondary" onClick={() => setShowDelete(false)} disabled={busy} type="button">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}