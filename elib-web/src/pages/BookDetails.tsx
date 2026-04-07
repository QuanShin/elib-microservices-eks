import { useEffect, useMemo, useState } from "react";
import { getBook, updateBook, deleteBook, listBooks, type Book, type BookCreate } from "../lib/catalogApi";
import { checkoutBook, returnBook, myLoans, type Loan } from "../lib/borrowApi";
import BookCover from "../components/BookCover";

function fmt(dt?: string | null) {
  if (!dt) return "";
  try {
    return new Date(dt).toLocaleString();
  } catch {
    return dt;
  }
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
  const [allBooks, setAllBooks] = useState<any[]>([]);
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
    description: "",
    coverImageUrl: ""
  } as any);

  const samplePages = [
    `Chapter 1

The library was quieter than usual that afternoon. Sunlight slipped through the tall windows and stretched across the reading tables in soft bands. A single book lay open in the center, waiting for its next reader.`,

    `Chapter 2

Mina turned the page carefully. The paper felt warm under her hand, and the printed words seemed to pull her deeper into the story. Outside, the city moved quickly. Inside, time slowed down.`,

    `Chapter 3

She liked that a library could hold thousands of voices and still feel peaceful. Every shelf promised another direction, another perspective, another world waiting just one page away.`
  ];

  const [readerOpen, setReaderOpen] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const [readerLarge, setReaderLarge] = useState(false);
  const isAdmin = role === "ADMIN";

  const activeLoanForThisBook = useMemo(() => {
    if (!loans) return null;
    return loans.find((l) => l.bookId === id && !l.returnedAtUtc) ?? null;
  }, [loans, id]);

  const relatedBooks = useMemo(() => {
    if (!book) return [];
    return allBooks
      .filter((b) => b.id !== book.id)
      .filter(
        (b) =>
          b.category === book.category ||
          b.author.toLowerCase() === book.author.toLowerCase()
      )
      .slice(0, 4);
  }, [allBooks, book]);

  async function loadBook() {
    setBusy(true);
    setErr(null);
    try {
      const b: any = await getBook(id);
      setBook(b);
      setForm({
        title: b.title,
        author: b.author,
        category: b.category,
        year: b.year,
        isbn: b.isbn ?? "",
        description: b.description ?? "",
        coverImageUrl: b.coverImageUrl ?? ""
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

  async function loadSuggestions() {
    try {
      const data = await listBooks();
      setAllBooks(data as any[]);
    } catch {
      // keep silent; suggestions are non-critical
    }
  }

  useEffect(() => {
    setOk(null);
    setErr(null);
    setEdit(false);
    setShowDelete(false);
    setLoans(null);
    setReaderOpen(false);
    setPageIndex(0);
    loadBook();
    loadLoans();
    loadSuggestions();
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
      const updated: any = await updateBook(id, {
        title: form.title.trim(),
        author: form.author.trim(),
        category: form.category.trim(),
        year: Number(form.year),
        isbn: form.isbn?.trim() || undefined,
        description: form.description?.trim() || undefined,
        coverImageUrl: (form as any).coverImageUrl?.trim() || undefined
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
    <div className="bookDetailsShell modernDetailsShell luxuryDetailsShell">
      <div className="toolbar">
        <button className="btn secondary bookBackBar" onClick={onBack} type="button">
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
        <section className="bookDetailsCard modernDetailsCard luxuryDetailsCard">
          <div className="bookDetailsCoverWrap modernDetailsCoverWrap">
            <BookCover
              title={book.title}
              category={book.category}
              className="bookDetailsCover"
              coverImageUrl={(book as any).coverImageUrl}
            />
          </div>

          <div className="bookDetailsBody modernDetailsBody">
            <div className="bookDetailsHeader modernDetailsHeader">
              <div className="eyebrowTag">Signature Edition</div>
              <h1 className="bookDetailsTitle modernBookTitle">{book.title}</h1>
              <div className="bookAuthorLine">{book.author}</div>

              <div className="bookDetailsMeta modernMetaRow">
                <span className="metaTag">{book.category}</span>
                <span className="metaTag">{book.year}</span>
                {book.isbn ? <span className="metaTag">ISBN {book.isbn}</span> : null}
              </div>
            </div>

            <div className="modernOverviewCard">
              <div className="sectionKicker">Overview</div>
              <div className="bookDetailsDesc modernBookDesc">
                {book.description?.trim()
                  ? book.description
                  : "No description was provided for this title yet."}
              </div>
            </div>

            <div className="bookInfoGrid modernInfoGrid">
              <div className="infoMiniCard">
                <div className="infoMiniLabel">Author</div>
                <div className="infoMiniValue">{book.author}</div>
              </div>

              <div className="infoMiniCard">
                <div className="infoMiniLabel">Category</div>
                <div className="infoMiniValue">{book.category}</div>
              </div>

              <div className="infoMiniCard">
                <div className="infoMiniLabel">Published</div>
                <div className="infoMiniValue">{book.year}</div>
              </div>
            </div>

            <div className="loanStateCard modernLoanCard">
              {!activeLoanForThisBook ? (
                <>
                  <div className="loanStateTitle">Available now</div>
                  <div className="loanStateText">This title is available for checkout right now.</div>
                </>
              ) : (
                <>
                  <div className="loanStateTitle">Currently borrowed</div>
                  <div className="loanStateText">Borrowed: {fmt(activeLoanForThisBook.borrowedAtUtc)}</div>
                  <div className="loanStateText">Due: {fmt(activeLoanForThisBook.dueAtUtc)}</div>
                </>
              )}
            </div>

            <div className="bookReader modernReader">
              <div className="bookReaderTop">
                <div>
                  <div className="bookReaderTitle">Read sample</div>
                  <div className="sectionSubtitle">Preview a few sample pages and use lightweight reading controls.</div>
                </div>

                <div className="bookReaderTools">
                  <button className="readerTool" onClick={() => setReaderOpen((v) => !v)} type="button">
                    {readerOpen ? "Hide reader" : "Open reader"}
                  </button>

                  <button className="readerTool" onClick={() => setReaderLarge((v) => !v)} type="button">
                    {readerLarge ? "Normal text" : "Larger text"}
                  </button>
                </div>
              </div>

              {readerOpen && (
                <>
                  <div className="readerPages">
                    <div className="readerPage">
                      <div className="readerPageNum">Page {pageIndex + 1}</div>
                      <div className="readerPageText" style={{ fontSize: readerLarge ? 17 : 15 }}>
                        {samplePages[pageIndex]}
                      </div>
                    </div>
                  </div>

                  <div className="readerNav">
                    <button
                      className="btn secondary"
                      onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
                      disabled={pageIndex === 0}
                      type="button"
                    >
                      Previous
                    </button>

                    <button
                      className="btn secondary"
                      onClick={() => setPageIndex((p) => Math.min(samplePages.length - 1, p + 1))}
                      disabled={pageIndex === samplePages.length - 1}
                      type="button"
                    >
                      Next
                    </button>
                  </div>
                </>
              )}
            </div>

            {relatedBooks.length > 0 && (
              <div className="surfaceCard relatedBooksPanel">
                <div className="sectionTitle">You may also like</div>
                <div className="sectionSubtitle">
                  Similar books selected by genre and author proximity.
                </div>

                <div className="relatedBooksGrid">
                  {relatedBooks.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="relatedBookCard"
                      onClick={() => {
                        window.scrollTo({ top: 0, behavior: "smooth" });
                        onChanged();
                        onBack();
                        setTimeout(() => {
                          window.location.hash = `book-${item.id}`;
                        }, 0);
                      }}
                    >
                      <BookCover
                        title={item.title}
                        category={item.category}
                        className="relatedBookThumb"
                        coverImageUrl={item.coverImageUrl}
                      />
                      <div className="relatedBookBody">
                        <div className="relatedBookTitle">{item.title}</div>
                        <div className="relatedBookMeta">{item.author}</div>
                        <div className="relatedBookMeta">{item.category}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="bookActionRow modernActionRow">
              {!activeLoanForThisBook ? (
                <button className="btn primary" onClick={onBorrow} disabled={busy || loanBusy} type="button">
                  {loanBusy ? "Processing…" : "Borrow this book"}
                </button>
              ) : (
                <button className="btn secondary" onClick={onReturn} disabled={busy || loanBusy} type="button">
                  {loanBusy ? "Processing…" : "Return this book"}
                </button>
              )}

              <button className="btn secondary" onClick={onBack} type="button">
                Back to catalog
              </button>
            </div>
          </div>
        </section>
      )}

      {book && edit && (
        <div className="surfaceCard">
          <div className="sectionTitle">Edit Book</div>
          <div className="sectionSubtitle">Update metadata, description, and premium cover for this title.</div>

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

          <label>Cover Image URL</label>
          <input
            value={(form as any).coverImageUrl ?? ""}
            onChange={(e) => setForm((p) => ({ ...p, coverImageUrl: e.target.value } as any))}
            placeholder="https://..."
          />

          <label>Description</label>
          <textarea rows={5} value={form.description ?? ""} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />

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