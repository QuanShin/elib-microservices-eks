import { useEffect, useState } from "react";
import { adminSummary, type BorrowSummary } from "../lib/borrowAdminApi";

export default function AdminDashboard({ onBack }: { onBack: () => void }) {
  const [data, setData] = useState<BorrowSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setBusy(true);
    setErr(null);
    try {
      const summary = await adminSummary();
      setData(summary);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load admin summary");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <section className="page-section">
      <div className="toolbar toolbar--split">
        <button className="btn secondary btn-inline" style={{ marginTop: 0 }} onClick={onBack} type="button">
          ← Back to catalog
        </button>
        <button className="btn secondary btn-inline" style={{ marginTop: 0 }} onClick={load} disabled={busy} type="button">
          {busy ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {err && <div className="msg error">{err}</div>}

      {data && (
        <>
          <div className="stats-grid stats-grid--triple">
            <div className="stat-card">
              <div className="stat-card__label">Total loans</div>
              <div className="stat-card__value">{data.totalLoans}</div>
            </div>
            <div className="stat-card">
              <div className="stat-card__label">Active loans</div>
              <div className="stat-card__value">{data.activeLoans}</div>
            </div>
            <div className="stat-card">
              <div className="stat-card__label">Overdue loans</div>
              <div className="stat-card__value">{data.overdueLoans}</div>
            </div>
          </div>

          <div className="summary-card">
            <div className="section-kicker">Insights</div>
            <h3>Top borrowers</h3>
            <div className="borrower-list">
              {data.topBorrowers.map((item, index) => (
                <div key={item.userId} className="borrower-row">
                  <div className="borrower-rank">#{index + 1}</div>
                  <div>
                    <div className="borrower-name">User ID {item.userId}</div>
                    <div className="muted small">{item.total} total loan(s)</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
}