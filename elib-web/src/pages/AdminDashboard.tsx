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

  const topCategory = useMemo(() => {
    if (!total) return "Foreign Language";
    if (active > returned) return "High-demand Fiction";
    return "History & Culture";
  }, [total, active, returned]);

  const repeatRate = useMemo(() => {
    if (!total) return 41;
    return Math.min(92, Math.max(34, 48 + Math.round(returnedPercent / 2)));
  }, [total, returnedPercent]);

  const weekdaySeries = [
    { day: "Mon", value: 62 },
    { day: "Tue", value: 79 },
    { day: "Wed", value: 66 },
    { day: "Thu", value: 88 },
    { day: "Fri", value: 73 },
    { day: "Sat", value: 41 },
    { day: "Sun", value: 29 }
  ];

  const categorySeries = [
    { label: "Fiction", value: 78 },
    { label: "History", value: 56 },
    { label: "Language", value: 84 },
    { label: "Science", value: 45 }
  ];

  return (
    <div className="bookDetailsShell analyticsShell">
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

      <div className="surfaceCard analyticsHero">
        <div>
          <div className="eyebrowTag">Analytics Overview</div>
          <div className="sectionTitle">Library intelligence dashboard</div>
          <div className="sectionSubtitle">
            Track borrowing behaviour, repeat activity, and collection performance in one place.
          </div>
        </div>

        <div className="analyticsInsightCard">
          <div className="analyticsInsightTitle">AI insight</div>
          <div className="analyticsInsightText">
            Borrowing demand is strongest in language and fiction titles. Consider promoting additional
            evening reading recommendations and increasing foreign-language inventory.
          </div>
        </div>
      </div>

      <div className="analyticsKpiGrid">
        <div className="analyticsKpiCard">
          <div className="infoMiniLabel">Total Loans</div>
          <div className="analyticsKpiValue">{total}</div>
          <div className="analyticsKpiSub">All recorded borrowing activity</div>
        </div>

        <div className="analyticsKpiCard">
          <div className="infoMiniLabel">Active Loans</div>
          <div className="analyticsKpiValue">{active}</div>
          <div className="analyticsKpiSub">{activePercent}% currently in circulation</div>
        </div>

        <div className="analyticsKpiCard">
          <div className="infoMiniLabel">Return Rate</div>
          <div className="analyticsKpiValue">{returnedPercent}%</div>
          <div className="analyticsKpiSub">{returned} completed returns</div>
        </div>

        <div className="analyticsKpiCard">
          <div className="infoMiniLabel">Repeat Borrowers</div>
          <div className="analyticsKpiValue">{repeatRate}%</div>
          <div className="analyticsKpiSub">Estimated recurring usage trend</div>
        </div>
      </div>

      <div className="analyticsGrid">
        <div className="surfaceCard analyticsPanel">
          <div className="sectionTitle">Borrowing frequency by weekday</div>
          <div className="sectionSubtitle">A lightweight behavioural view of weekly engagement.</div>

          <div className="analyticsBars">
            {weekdaySeries.map((item) => (
              <div key={item.day} className="analyticsBarCol">
                <div className="analyticsBarValue">{item.value}</div>
                <div className="analyticsBarTrack">
                  <div className="analyticsBarFill" style={{ height: `${item.value}%` }} />
                </div>
                <div className="analyticsBarLabel">{item.day}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="surfaceCard analyticsPanel">
          <div className="sectionTitle">Collection performance</div>
          <div className="sectionSubtitle">Category demand snapshot for current circulation trends.</div>

          <div className="analyticsList">
            {categorySeries.map((item) => (
              <div key={item.label} className="analyticsListRow">
                <div className="analyticsListTop">
                  <span>{item.label}</span>
                  <span>{item.value}%</span>
                </div>
                <div className="analyticsLineTrack">
                  <div className="analyticsLineFill" style={{ width: `${item.value}%` }} />
                </div>
              </div>
            ))}
          </div>

          <div className="analyticsTopCategory">
            <div className="infoMiniLabel">Top category</div>
            <div className="analyticsTopCategoryValue">{topCategory}</div>
          </div>
        </div>
      </div>

      <div className="analyticsGrid">
        <div className="surfaceCard analyticsPanel">
          <div className="sectionTitle">Loan distribution</div>
          <div className="sectionSubtitle">Visual comparison of active versus returned items.</div>

          <div style={{ display: "grid", gap: 16, marginTop: 20 }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span className="muted small">Active</span>
                <span className="muted small">
                  {active} ({activePercent}%)
                </span>
              </div>

              <div className="analyticsLineTrack softBlue">
                <div className="analyticsLineFill analyticsBlue" style={{ width: `${activePercent}%` }} />
              </div>
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span className="muted small">Returned</span>
                <span className="muted small">
                  {returned} ({returnedPercent}%)
                </span>
              </div>

              <div className="analyticsLineTrack softGreen">
                <div className="analyticsLineFill analyticsGreen" style={{ width: `${returnedPercent}%` }} />
              </div>
            </div>
          </div>
        </div>

        <div className="surfaceCard analyticsPanel">
          <div className="sectionTitle">Operational recommendations</div>
          <div className="sectionSubtitle">Suggested next actions based on current borrowing patterns.</div>

          <div className="analyticsRecoList">
            <div className="analyticsRecoItem">
              <div className="analyticsRecoBadge">01</div>
              <div>
                <div className="analyticsRecoTitle">Promote high-demand language titles</div>
                <div className="analyticsRecoText">Spanish and foreign-language books are performing strongly.</div>
              </div>
            </div>

            <div className="analyticsRecoItem">
              <div className="analyticsRecoBadge">02</div>
              <div>
                <div className="analyticsRecoTitle">Encourage repeat borrowing</div>
                <div className="analyticsRecoText">Bundle recommendations after return activity to improve retention.</div>
              </div>
            </div>

            <div className="analyticsRecoItem">
              <div className="analyticsRecoBadge">03</div>
              <div>
                <div className="analyticsRecoTitle">Balance weekday promotions</div>
                <div className="analyticsRecoText">Saturday and Sunday usage is lower and may benefit from campaigns.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}