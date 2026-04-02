import { useEffect, useMemo, useState } from "react";
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

  const total = data?.total ?? 0;
  const active = data?.active ?? 0;
  const returned = data?.returned ?? 0;

  const activePercent = useMemo(() => {
    if (!total) return 0;
    return Math.round((active / total) * 100);
  }, [active, total]);

  const returnedPercent = useMemo(() => {
    if (!total) return 0;
    return Math.round((returned / total) * 100);
  }, [returned, total]);

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
          Monitor total borrowing volume, active circulation, and returned items.
        </div>
      </div>

      <div className="bookInfoGrid">
        <div className="infoMiniCard">
          <div className="infoMiniLabel">Total Loans</div>
          <div className="infoMiniValue" style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-.03em" }}>
            {total}
          </div>
        </div>

        <div className="infoMiniCard">
          <div className="infoMiniLabel">Active Loans</div>
          <div className="infoMiniValue" style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-.03em" }}>
            {active}
          </div>
        </div>

        <div className="infoMiniCard">
          <div className="infoMiniLabel">Returned Loans</div>
          <div className="infoMiniValue" style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-.03em" }}>
            {returned}
          </div>
        </div>
      </div>

      <div className="surfaceCard">
        <div className="sectionTitle">Loan Distribution</div>
        <div className="sectionSubtitle">
          Visual breakdown of active versus returned borrowing records.
        </div>

        <div style={{ display: "grid", gap: 16, marginTop: 20 }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span className="muted small">Active</span>
              <span className="muted small">
                {active} ({activePercent}%)
              </span>
            </div>

            <div
              style={{
                width: "100%",
                height: 14,
                borderRadius: 999,
                background: "rgba(99, 102, 241, 0.12)",
                overflow: "hidden"
              }}
            >
              <div
                style={{
                  width: `${activePercent}%`,
                  height: "100%",
                  borderRadius: 999,
                  background: "linear-gradient(90deg, #60a5fa, #8b5cf6)"
                }}
              />
            </div>
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span className="muted small">Returned</span>
              <span className="muted small">
                {returned} ({returnedPercent}%)
              </span>
            </div>

            <div
              style={{
                width: "100%",
                height: 14,
                borderRadius: 999,
                background: "rgba(16, 185, 129, 0.12)",
                overflow: "hidden"
              }}
            >
              <div
                style={{
                  width: `${returnedPercent}%`,
                  height: "100%",
                  borderRadius: 999,
                  background: "linear-gradient(90deg, #34d399, #10b981)"
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}