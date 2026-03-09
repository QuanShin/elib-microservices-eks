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
            setMetaErr((prev) => prev ?? `Cannot load some book metadata from CatalogService.`);
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

  async function onReturn(bookId: number) {
    setBusy(true);
    setErr(null);
    setMetaErr(null);
    setOk(null);
    try {
      await returnBook(bookId);
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
    const meta = book ? `${book.author} • ${book.category} • ${book.year}` : "Book details unavailable";

    const dueDays = !isHistory ? daysLeft(l.dueAtUtc) : null;
    const dueText =
      !isHistory
        ? dueDays! < 0
          ? `Overdue by ${Math.abs(dueDays!)} day(s)`
          : `Due in ${dueDays} day(s)`
        : "";

    return (
      <div
        key={l.id}
        style={{
          marginTop: 10,
          padding: 12,
          borderRadius: 16,
          border: "1px solid var(--line)",
          background: "#fff"
        }}
      >
        <div className="bookCardRow">
          <div className="bookThumb" style={coverStyle(`${title}-${l.bookId}`)} />
          <div>
            <div style={{ fontWeight: 900 }}>{title}</div>
            <div className="muted small">{meta}</div>

            <div className="muted small" style={{ marginTop: 6 }}>
              Borrowed: {fmt(l.borrowedAtUtc)}
            </div>

            {!isHistory && (
              <div className="muted small">
                Due: {fmt(l.dueAtUtc)} ({dueText})
              </div>
            )}

            {isHistory && (
              <div className="muted small">
                Returned: {fmt(l.returnedAtUtc)}
              </div>
            )}

            <div className="grid2" style={{ marginTop: 10 }}>
              <button className="btn secondary" onClick={() => onOpenBook(l.bookId)} disabled={busy} type="button">
                View book
              </button>

              {!isHistory && (
                <button className="btn primary" onClick={() => onReturn(l.bookId)} disabled={busy} type="button">
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
    <div className="panel">
      <div className="toolbar">
        <button className="btn secondary" style={{ marginTop: 0 }} onClick={onBack} type="button">
          ← Back
        </button>
        <button className="btn secondary" style={{ marginTop: 0 }} onClick={load} disabled={busy} type="button">
          Refresh
        </button>
      </div>

      <div
        style={{
          marginTop: 12,
          padding: 12,
          borderRadius: 16,
          border: "1px solid var(--line)",
          background: "#fff"
        }}
      >
        <div style={{ fontWeight: 900, marginBottom: 6 }}>Quick test</div>
        <div className="muted small">
          Borrow a book by ID for testing.
        </div>

        <div className="grid2" style={{ marginTop: 10 }}>
          <input
            type="number"
            value={testBookId}
            onChange={(e) => setTestBookId(Number(e.target.value))}
            placeholder="Book ID"
          />
          <button className="btn primary" onClick={onBorrowTest} disabled={busy} type="button">
            Borrow book
          </button>
        </div>
      </div>

      {busy && <div className="muted">Loading…</div>}
      {err && <div className="msg error">{err}</div>}
      {metaErr && <div className="msg error">{metaErr}</div>}
      {ok && <div className="msg ok">{ok}</div>}

      <div style={{ marginTop: 14 }}>
        <div style={{ fontWeight: 900 }}>Active Loans</div>
        {loans && active.length === 0 && <div className="muted small" style={{ marginTop: 8 }}>No active loans.</div>}
        {active.map((l) => renderLoanCard(l, false))}
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={{ fontWeight: 900 }}>History</div>
        {loans && history.length === 0 && <div className="muted small" style={{ marginTop: 8 }}>No returned books yet.</div>}
        {history.map((l) => renderLoanCard(l, true))}
      </div>
    </div>
  );
}