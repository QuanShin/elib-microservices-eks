import { useEffect, useMemo, useState } from "react";
import { myLoans, returnBook, checkoutBook, type Loan } from "../lib/borrowApi";
import { getBook, type Book } from "../lib/catalogApi";

function fmt(dt?: string | null) {
  if (!dt) return "";
  try {
    return new Date(dt).toLocaleString();
  } catch {
    return dt;
  }
}

function daysLeft(dueAtUtc: string) {
  const due = new Date(dueAtUtc).getTime();
  const now = Date.now();
  return Math.ceil((due - now) / (1000 * 60 * 60 * 24));
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

function BookCover({ title, category, seed }: { title: string; category: string; seed: string }) {
  return (
    <div
      className="bookThumb"
      style={coverStyle(seed)}
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

export default function MyLoans({
  onBack,
  onOpenBook
}: {
  onBack: () => void;
  onOpenBook: (bookId: number) => void;
}) {
  const [loans, setLoans] = useState<Loan[] | null>(null);
  const [bookMap, setBookMap] = useState<Record<number, Book | null>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [metaErr, setMetaErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [testBookId, setTestBookId] = useState<number>(1);

  const active = useMemo(() => (loans ?? []).filter((l) => !l.returnedAtUtc), [loans]);
  const history = useMemo(() => (loans ?? []).filter((l) => !!l.returnedAtUtc), [loans]);

  async function load() {
    setBusy(true);
    setErr(null);
    setMetaErr(null);

    try {
      const data = await myLoans();
      setLoans(data);

      const ids = Array.from(new Set(data.map((x) => x.bookId)));

      if (ids.length === 0) {
        setBookMap({});
        return;
      }

      const entries = await Promise.all(
        ids.map(async (bid) => {
          try {
            const b = await getBook(bid);
            return [bid, b] as const;
          } catch {
            setMetaErr((prev) => prev ?? "Cannot load some book metadata from CatalogService.");
            return [bid, null] as const;
          }
        })
      );

      setBookMap(Object.fromEntries(entries));
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load loans");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function onBorrowTest() {
    setBusy(true);
    setErr(null);
    setMetaErr(null);
    setOk(null);
    try {
      await checkoutBook(testBookId);
      await load();
      setOk(`Borrowed bookId=${testBookId} ✅`);
      setTimeout(() => setOk(null), 1500);
    } catch (e: any) {
      setErr(e?.message ?? "Borrow failed");
    } finally {
      setBusy(false);
    }
  }

  async function onReturn(loanId: number) {
    setBusy(true);
    setErr(null);
    setMetaErr(null);
    setOk(null);
    try {
      await returnBook(loanId);
      await load();
      setOk("Returned ✅");
      setTimeout(() => setOk(null), 1500);
    } catch (e: any) {
      setErr(e?.message ?? "Return failed");
    } finally {
      setBusy(false);
    }
  }

  function renderLoanCard(l: Loan, isHistory: boolean) {
    const book = bookMap[l.bookId] ?? null;

    const title = book ? book.title : `Book ID: ${l.bookId}`;
    const author = book?.author ?? "Unknown author";
    const category = book?.category ?? "Unavailable";
    const year = book?.year ?? "—";

    const dueDays = !isHistory ? daysLeft(l.dueAtUtc) : null;
    const dueText =
      !isHistory
        ? dueDays! < 0
          ? `Overdue by ${Math.abs(dueDays!)} day(s)`
          : `Due in ${dueDays} day(s)`
        : "";

    return (
      <div key={l.id} className="loanCard">
        <div className="bookCardRow">
          <BookCover
            title={title}
            category={category}
            seed={`${title}-${l.bookId}`}
          />

          <div className="bookDetailsBody">
            <div className="bookDetailsHeader">
              <div className="bookTitle">{title}</div>

              <div className="bookDetailsMeta">
                <span className="metaTag">{author}</span>
                <span className="metaTag">{category}</span>
                <span className="metaTag">{year}</span>
                <span className="metaTag">{isHistory ? "Returned" : "Active loan"}</span>
              </div>
            </div>

            <div className="loanStateCard">
              <div className="loanStateText">Borrowed: {fmt(l.borrowedAtUtc)}</div>

              {!isHistory && (
                <>
                  <div className="loanStateText">Due: {fmt(l.dueAtUtc)}</div>
                  <div className="loanStateText">{dueText}</div>
                </>
              )}

              {isHistory && (
                <div className="loanStateText">Returned: {fmt(l.returnedAtUtc)}</div>
              )}
            </div>

            <div className="bookActionRow">
              <button
                className="btn secondary"
                onClick={() => onOpenBook(l.bookId)}
                disabled={busy}
                type="button"
              >
                View book
              </button>

              {!isHistory && (
                <button
                  className="btn primary"
                  onClick={() => onReturn(l.id)}
                  disabled={busy}
                  type="button"
                >
                  Return
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bookDetailsShell">
      <div className="toolbar">
        <button className="btn secondary bookBackBar" onClick={onBack} type="button">
          ← Back
        </button>

        <button
          className="btn secondary"
          style={{ marginTop: 0, width: "auto" }}
          onClick={load}
          disabled={busy}
          type="button"
        >
          Refresh
        </button>
      </div>

      <div className="surfaceCard">
        <div className="sectionTitle">My Loans</div>
        <div className="sectionSubtitle">
          Review active loans, inspect returned history, and test borrowing directly by book ID.
        </div>

        <div className="grid2" style={{ marginTop: 16 }}>
          <div>
            <label>Quick test book ID</label>
            <input
              type="number"
              value={testBookId}
              onChange={(e) => setTestBookId(Number(e.target.value))}
              placeholder="Book ID"
            />
          </div>

          <div style={{ display: "flex", alignItems: "end" }}>
            <button className="btn primary" onClick={onBorrowTest} disabled={busy} type="button">
              Borrow book
            </button>
          </div>
        </div>
      </div>

      {busy && <div className="muted">Loading…</div>}
      {err && <div className="msg error">{err}</div>}
      {metaErr && <div className="msg error">{metaErr}</div>}
      {ok && <div className="msg ok">{ok}</div>}

      <div className="surfaceCard">
        <div className="sectionTitle">Active Loans</div>
        <div className="sectionSubtitle">
          Books currently checked out and ready for return.
        </div>

        {loans && active.length === 0 ? (
          <div className="muted small" style={{ marginTop: 12 }}>
            No active loans.
          </div>
        ) : (
          <div className="loansGrid" style={{ marginTop: 16 }}>
            {active.map((l) => renderLoanCard(l, false))}
          </div>
        )}
      </div>

      <div className="surfaceCard">
        <div className="sectionTitle">History</div>
        <div className="sectionSubtitle">
          Previously borrowed titles that have already been returned.
        </div>

        {loans && history.length === 0 ? (
          <div className="muted small" style={{ marginTop: 12 }}>
            No returned books yet.
          </div>
        ) : (
          <div className="loansGrid" style={{ marginTop: 16 }}>
            {history.map((l) => renderLoanCard(l, true))}
          </div>
        )}
      </div>
    </div>
  );
}