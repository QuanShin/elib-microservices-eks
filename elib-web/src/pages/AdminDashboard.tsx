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
    <div className="bookDetailsShell">
      <div className="toolbar">
        <button className="btn secondary bookBackBar" onClick={onBack} type="button">
          ← Back to catalog
        </button>

        <button
          className="btn secondary"
          style={{ marginTop: 0, width: "auto" }}
          onClick={load}
          disabled={busy}
          type="button"
        >
          {busy ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {err && <div className="msg error">{err}</div>}

      <div className="surfaceCard">
        <div className="sectionTitle">Admin Dashboard</div>
        <div className="sectionSubtitle">
          Monitor loan activity, active borrowing, overdue items, and high-usage users.
        </div>
      </div>

      {data && (
        <>
          <div className="bookInfoGrid">
            <div className="infoMiniCard">
              <div className="infoMiniLabel">Total Loans</div>
              <div
                className="infoMiniValue"
                style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-.03em" }}
              >
                {data.totalLoans}
              </div>
            </div>

            <div className="infoMiniCard">
              <div className="infoMiniLabel">Active Loans</div>
              <div
                className="infoMiniValue"
                style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-.03em" }}
              >
                {data.activeLoans}
              </div>
            </div>

            <div className="infoMiniCard">
              <div className="infoMiniLabel">Overdue Loans</div>
              <div
                className="infoMiniValue"
                style={{
                  fontSize: 28,
                  fontWeight: 900,
                  letterSpacing: "-.03em",
                  color: data.overdueLoans > 0 ? "var(--danger)" : "var(--txt)"
                }}
              >
                {data.overdueLoans}
              </div>
            </div>
          </div>

          <div className="surfaceCard">
            <div className="sectionTitle">Top Borrowers</div>
            <div className="sectionSubtitle">
              Users with the highest borrowing activity across the platform.
            </div>

            <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
              {data.topBorrowers.length === 0 ? (
                <div className="muted small">No borrower activity yet.</div>
              ) : (
                data.topBorrowers.map((item, index) => (
                  <div
                    key={item.userId}
                    className="loanCard"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 14
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
                      <div
                        style={{
                          width: 46,
                          height: 46,
                          borderRadius: 14,
                          display: "grid",
                          placeItems: "center",
                          fontWeight: 900,
                          color: "white",
                          background: "linear-gradient(135deg, #60a5fa, #8b5cf6)",
                          boxShadow: "0 10px 18px rgba(59,130,246,.18)",
                          flexShrink: 0
                        }}
                      >
                        #{index + 1}
                      </div>

                      <div style={{ minWidth: 0 }}>
                        <div className="bookTitle" style={{ marginBottom: 2 }}>
                          User ID {item.userId}
                        </div>
                        <div className="muted small">Borrowing activity summary</div>
                      </div>
                    </div>

                    <div className="metaTag" style={{ flexShrink: 0 }}>
                      {item.total} loan{item.total === 1 ? "" : "s"}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}