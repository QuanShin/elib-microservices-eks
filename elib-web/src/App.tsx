import { lazy, Suspense, useEffect, useState } from "react";
import "./App.css";
import { login, register, logout, checkMeNoRefresh, renewSession } from "./lib/authApi";

const AddBook = lazy(() => import("./pages/AddBook"));
const Catalog = lazy(() => import("./pages/Catalog"));
const BookDetails = lazy(() => import("./pages/BookDetails"));
const MyLoans = lazy(() => import("./pages/MyLoans"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));

type Me = { sub: string; email: string; role: string };

type View = "catalog" | "details" | "add" | "loans" | "admin";

function PageFallback() {
  return (
    <div style={{ padding: 24 }}>
      <div style={{ fontWeight: 800, fontSize: 18 }}>Loading page…</div>
    </div>
  );
}

export default function App() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");

  const [me, setMe] = useState<Me | null>(null);
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [view, setView] = useState<View>("catalog");
  const [selectedBookId, setSelectedBookId] = useState<number | null>(null);
  const [catalogReloadKey, setCatalogReloadKey] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    document.title = me ? `E-Library • ${me.email}` : "E-Library • Auth";
  }, [me]);

  function clearFlash() {
    setErr(null);
    setOk(null);
  }

  function goCatalog() {
    setView("catalog");
    setSelectedBookId(null);
    clearFlash();
    setMenuOpen(false);
  }

  async function onSubmit() {
    clearFlash();

    if (!email.includes("@")) {
      setErr("Enter a valid email.");
      return;
    }

    if (pw.length < 6) {
      setErr("Password must be at least 6 characters.");
      return;
    }

    if (mode === "register" && pw !== pw2) {
      setErr("Passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      if (mode === "register") {
        await register(email.trim(), pw);
        setOk("Registered. Logging in…");
      }

      await login(email.trim(), pw);
      const profile = await checkMeNoRefresh();
      setMe(profile);

      setView("catalog");
      setSelectedBookId(null);

      setOk("Logged in ✅");
      setTimeout(() => setOk(null), 1500);
    } catch (e: any) {
      setErr(e?.message ?? "Failed.");
    } finally {
      setBusy(false);
    }
  }

  async function onCheckMe() {
    clearFlash();
    try {
      const profile = await checkMeNoRefresh();
      setMe(profile);
      setOk("Check /me success ✅");
      setTimeout(() => setOk(null), 1500);
    } catch (e: any) {
      setErr(`Check /me failed: ${e?.message ?? "Unauthorized"}`);
    }
  }

  async function onRenew() {
    clearFlash();
    try {
      await renewSession();
      setOk("Session renewed ✅");
      setTimeout(() => setOk(null), 1500);
    } catch (e: any) {
      setErr(`Renew failed: ${e?.message ?? "Unauthorized"}`);
    }
  }

  async function onLogout() {
    clearFlash();
    try {
      await logout();
    } catch {
      // ignore
    }

    setMe(null);
    setView("catalog");
    setSelectedBookId(null);
    setCatalogReloadKey((k) => k + 1);
    setMenuOpen(false);

    setOk("Logged out ✅");
    setTimeout(() => setOk(null), 1200);
  }

  const isAdmin = me?.role === "ADMIN";

  function renderMain() {
    if (!me) return null;

    return (
      <Suspense fallback={<PageFallback />}>
        {view === "catalog" && (
          <Catalog
            key={catalogReloadKey}
            onSelect={(id: number) => {
              setSelectedBookId(id);
              setView("details");
              clearFlash();
            }}
          />
        )}

        {view === "details" && selectedBookId !== null && (
          <BookDetails
            id={selectedBookId}
            role={me.role}
            onBack={goCatalog}
            onChanged={() => setCatalogReloadKey((k) => k + 1)}
          />
        )}

        {view === "loans" && (
          <MyLoans
            onBack={goCatalog}
            onOpenBook={(bookId: number) => {
              setSelectedBookId(bookId);
              setView("details");
              clearFlash();
            }}
          />
        )}

        {view === "add" && isAdmin && (
          <AddBook
            onCreated={(createdId?: number) => {
              setCatalogReloadKey((k) => k + 1);

              if (createdId) {
                setSelectedBookId(createdId);
                setView("details");
              } else {
                goCatalog();
              }

              setOk("Book added ✅");
              setTimeout(() => setOk(null), 1500);
            }}
          />
        )}
        {view === "admin" && isAdmin && <AdminDashboard onBack={goCatalog} />}
      </Suspense>
    );
  }

  return (
    <div className="appShell">
      {!me ? (
        <div className="authWrap">
          <div className="authCard">
            <div className="top">
              <div>
                <div className="title">E-Library</div>
                <div className="subtitle">Bright UI • Auth + Catalog + Borrow</div>
              </div>
              <span className="chip">LOCAL DEV</span>
            </div>

            <div className="heroBanner">
              <div className="heroText">
                <div className="heroKicker">Modern library workspace</div>
                <h1>Borrow books with a cleaner, brighter interface.</h1>
                <p className="muted">
                  Your backend and authentication flow stay the same. This update only changes the interface and removes the dead Borrow again action.
                </p>
              </div>
              <div className="heroBooks">
                <div className="heroBook heroBook1" />
                <div className="heroBook heroBook2" />
                <div className="heroBook heroBook3" />
              </div>
            </div>

            <div className="tabs">
              <button
                className={mode === "login" ? "tab active" : "tab"}
                onClick={() => {
                  setMode("login");
                  clearFlash();
                }}
                type="button"
              >
                Login
              </button>
              <button
                className={mode === "register" ? "tab active" : "tab"}
                onClick={() => {
                  setMode("register");
                  clearFlash();
                }}
                type="button"
              >
                Register
              </button>
            </div>

            <label>Email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />

            <label>Password</label>
            <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Enter password" />

            {mode === "register" && (
              <>
                <label>Confirm Password</label>
                <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="Repeat password" />
              </>
            )}

            <button className="btn primary" disabled={busy} onClick={onSubmit} type="button">
              {busy ? "Please wait…" : mode === "register" ? "Register" : "Login"}
            </button>

            {err && <div className="msg error">{err}</div>}
            {ok && <div className="msg ok">{ok}</div>}

            <div className="hint">
              Auth: <span className="code">/api/auth</span> • Catalog: <span className="code">/api/catalog</span> • Borrow: <span className="code">/api/borrow</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="workspace">
          {menuOpen && (
            <button
              className="sidebarScrim"
              type="button"
              onClick={() => setMenuOpen(false)}
              aria-label="Close sidebar"
            />
          )}

          <aside className={`sidebar ${menuOpen ? "open" : ""}`}>
            <div className="sidebarBrand">
              <div className="sidebarTitle">E-Library</div>
              <div className="sidebarSub">Reader workspace</div>
            </div>

            <div className="profileCard">
              <div className="avatar">{(me.email?.[0] ?? "U").toUpperCase()}</div>
              <div>
                <div className="profileName">{me.email}</div>
                <div className="profileRole">{me.role}</div>
              </div>
            </div>

            <div className="sideNav">
              <button className={`sideBtn ${view === "catalog" ? "active" : ""}`} onClick={goCatalog} type="button">
                Discover
              </button>

              <button
                className={`sideBtn ${view === "loans" ? "active" : ""}`}
                onClick={() => {
                  setView("loans");
                  setSelectedBookId(null);
                  clearFlash();
                  setMenuOpen(false);
                }}
                type="button"
              >
                My Loans
              </button>

              {isAdmin && (
                <>
                  <button
                    className={`sideBtn ${view === "add" ? "active" : ""}`}
                    onClick={() => {
                      setView("add");
                      setSelectedBookId(null);
                      clearFlash();
                      setMenuOpen(false);
                    }}
                    type="button"
                  >
                    Add Book
                  </button>

                  <button
                    className={`sideBtn ${view === "admin" ? "active" : ""}`}
                    onClick={() => {
                      setView("admin");
                      setSelectedBookId(null);
                      clearFlash();
                      setMenuOpen(false);
                    }}
                    type="button"
                  >
                    Admin Dashboard
                  </button>
                </>
              )}
            </div>

            <div className="sidebarTools">
              <button className="btn secondary" onClick={onCheckMe} type="button">
                Check /me
              </button>
              <button className="btn secondary" onClick={onRenew} type="button">
                Renew session
              </button>
              <button className="btn danger" onClick={onLogout} type="button">
                Logout
              </button>
            </div>
          </aside>

          <main className="mainPane">
            <div className="mainHeader">
              <div className="mainHeaderLeft">
                <button
                  className="hamburger"
                  onClick={() => setMenuOpen((v) => !v)}
                  type="button"
                  aria-label="Toggle menu"
                >
                  <span />
                  <span />
                  <span />
                </button>

                <div>
                  <div className="pageTitle">
                    {view === "details"
                      ? "Book Details"
                      : view === "catalog"
                      ? "Discover"
                      : view === "loans"
                      ? "My Loans"
                      : view === "add"
                      ? "Add Book"
                      : "Admin Dashboard"}
                  </div>
                  <div className="subtitle">
                    Logged in as {me.email} ({me.role})
                  </div>
                </div>
              </div>

              <div className="chip chipSoft">User #{me.sub}</div>
            </div>

            {(err || ok) && (
              <div className="flashWrap">
                {err && <div className="msg error">{err}</div>}
                {ok && <div className="msg ok">{ok}</div>}
              </div>
            )}

            <div className="contentCard">{renderMain()}</div>
          </main>
        </div>
      )}
    </div>
  );
}