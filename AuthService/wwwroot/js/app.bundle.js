(() => {
  // ===== helpers =====
  const el = (id) => document.getElementById(id);
  const show = (id, yes = true) => { el(id).style.display = yes ? "block" : "none"; };
  const setText = (id, t) => { el(id).textContent = t; };
  const setError = (id, msg) => { setText(id, msg); show(id, true); };
  const clearError = (id) => { setText(id, ""); show(id, false); };

  const setOk = (msg) => { setText("msgOk", msg); show("msgOk", true); };
  const clearOk = () => show("msgOk", false);

  const setOk2 = (msg) => { setText("msgOk2", msg); show("msgOk2", true); };
  const clearOk2 = () => show("msgOk2", false);

  // ===== in-memory tokens only =====
  let accessToken = null;
  let csrfToken = null;

  // ===== JWT exp based countdown =====
  let tokenExpiresAtMs = null;
  let countdownTimer = null;

  function base64UrlToJson(b64url) {
    const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "===".slice((b64.length + 3) % 4);
    return JSON.parse(atob(padded));
  }

  function getJwtInfo(token) {
    const parts = (token || "").split(".");
    if (parts.length !== 3) return null;
    const header = base64UrlToJson(parts[0]);
    const payload = base64UrlToJson(parts[1]);
    return { header, payload };
  }

  function getJwtExpMs(token) {
    const info = getJwtInfo(token);
    if (!info?.payload?.exp) return null;
    return info.payload.exp * 1000;
  }

  function formatMMSS(totalSeconds) {
    totalSeconds = Math.max(0, Math.floor(totalSeconds));
    const mm = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
    const ss = String(totalSeconds % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  }

  function stopCountdown() {
    if (countdownTimer) clearInterval(countdownTimer);
    countdownTimer = null;
    tokenExpiresAtMs = null;
    if (el("tokenCountdown")) el("tokenCountdown").textContent = "--:--";
  }

  function startCountdownFromJwt(token) {
    stopCountdown();

    const expMs = getJwtExpMs(token);
    if (!expMs) {
      if (el("tokenCountdown")) el("tokenCountdown").textContent = "--:--";
      return;
    }

    tokenExpiresAtMs = expMs;

    const tick = () => {
      const remainingSec = (tokenExpiresAtMs - Date.now()) / 1000;
      if (el("tokenCountdown")) el("tokenCountdown").textContent = formatMMSS(remainingSec);
      if (remainingSec <= 0) {
        if (el("tokenCountdown")) el("tokenCountdown").textContent = "00:00";
      }
    };

    tick();
    countdownTimer = setInterval(tick, 1000);
  }

  function updateKidAndExpLabels(token) {
    const info = getJwtInfo(token);
    if (!info) {
      setText("kidLabel", "—");
      setText("expLabel", "—");
      return;
    }
    setText("kidLabel", info.header?.kid || "—");

    if (info.payload?.exp) {
      const expUtc = new Date(info.payload.exp * 1000).toISOString().replace(".000Z", "Z");
      setText("expLabel", expUtc);
    } else {
      setText("expLabel", "—");
    }
  }

  // ===== api =====
  async function api(path, { method = "GET", body = null, useAuth = false, useCsrf = false } = {}) {
    const headers = {};
    if (body) headers["Content-Type"] = "application/json";
    if (useAuth && accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
    if (useCsrf && csrfToken) headers["X-CSRF"] = csrfToken;

    return await fetch(path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : null,
      credentials: "include"
    });
  }

  async function readApiError(res) {
    try {
      const data = await res.json();
      return data.error || data.message || `Request failed (${res.status}).`;
    } catch {
      return res.status === 401 ? "Unauthorized." : `Request failed (${res.status}).`;
    }
  }

  // ===== auth operations =====
  async function doRegister(email, password) {
    const res = await api("/register", { method: "POST", body: { email, password, role: "MEMBER" } });
    if (!res.ok) throw new Error(await readApiError(res));
    return await res.json();
  }

  async function doLogin(email, password) {
    const res = await api("/login", { method: "POST", body: { email, password } });
    if (!res.ok) throw new Error(await readApiError(res));
    const data = await res.json();

    accessToken = data.accessToken;
    csrfToken = data.csrfToken;

    updateKidAndExpLabels(accessToken);
    startCountdownFromJwt(accessToken);

    return data;
  }

  async function doRefresh() {
    const res = await api("/refresh", { method: "POST", useCsrf: true });
    if (!res.ok) throw new Error(await readApiError(res));
    const data = await res.json();

    accessToken = data.accessToken;

    updateKidAndExpLabels(accessToken);
    startCountdownFromJwt(accessToken);

    return data;
  }

  // This ONLY checks /me and returns status. It does NOT refresh.
  async function checkMeNoRefresh() {
    const res = await api("/me", { method: "GET", useAuth: true });
    if (!res.ok) throw new Error(await readApiError(res));
    return await res.json();
  }

  async function doLogout() {
    const res = await api("/logout", { method: "POST", useCsrf: true });

    accessToken = null;
    csrfToken = null;
    stopCountdown();
    updateKidAndExpLabels(null);

    if (!res.ok) throw new Error(await readApiError(res));
    return await res.json();
  }

  // ===== UI logic =====
  let mode = "login";

  function setMode(next) {
    mode = next;
    el("tabLogin").classList.toggle("active", mode === "login");
    el("tabRegister").classList.toggle("active", mode === "register");
    show("confirmWrap", mode === "register");
    el("btnSubmit").textContent = mode === "register" ? "Register" : "Login";
    clearError("msgError");
    clearOk();
  }

  function setLoading(on) {
    el("btnSubmit").disabled = on;
    el("email").disabled = on;
    el("password").disabled = on;
    if (el("password2")) el("password2").disabled = on;
    el("btnSubmit").textContent = on ? "Please wait..." : (mode === "register" ? "Register" : "Login");
  }

  function showLoggedIn(profile) {
    show("authView", false);
    show("loggedInView", true);
    setText("meEmail", profile.email || "");
    setText("meRole", profile.role || "");
    setText("meSub", profile.sub || "");
  }

  function showLoggedOut() {
    show("loggedInView", false);
    show("authView", true);
    accessToken = null;
    csrfToken = null;
    stopCountdown();
    clearOk();
    clearOk2();
    clearError("msgError2");
    updateKidAndExpLabels(null);
  }

  async function handleSubmit() {
    clearError("msgError");
    clearOk();

    const email = el("email").value.trim();
    const password = el("password").value;
    const password2 = el("password2")?.value;

    if (!email.includes("@")) return setError("msgError", "Please enter a valid email.");
    if (password.length < 6) return setError("msgError", "Password must be at least 6 characters.");
    if (mode === "register" && password !== password2) return setError("msgError", "Passwords do not match.");

    setLoading(true);

    try {
      if (mode === "register") {
        await doRegister(email, password);
        setOk("Registered. Logging in…");
      }

      await doLogin(email, password);

      // Immediately check /me once (should pass)
      const profile = await checkMeNoRefresh();
      showLoggedIn(profile);

      clearOk2();
      setOk2(`Logged in ✅ (${new Date().toLocaleTimeString()})`);
      setTimeout(() => clearOk2(), 2000);

    } catch (e) {
      setError("msgError", e?.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCheckMe() {
    clearError("msgError2");
    clearOk2();

    try {
      const profile = await checkMeNoRefresh();
      showLoggedIn(profile);

      setOk2(`Check /me success ✅ (${new Date().toLocaleTimeString()})`);
      setTimeout(() => clearOk2(), 2000);
    } catch (e) {
      // This is where you'll see 401 after token expiry
      setError("msgError2", `Check /me failed: ${e?.message || "Unauthorized."}`);
    }
  }

  async function handleRenew() {
    clearError("msgError2");
    clearOk2();

    try {
      await doRefresh();
      setOk2(`Session renewed ✅ (${new Date().toLocaleTimeString()})`);
      setTimeout(() => clearOk2(), 2000);
    } catch (e) {
      setError("msgError2", `Renew failed: ${e?.message || "Unauthorized."}`);
    }
  }

  async function handleLogout() {
    clearError("msgError2");
    clearOk2();

    try {
      await doLogout();
      setOk2("Logged out ✅");
      setTimeout(() => clearOk2(), 1200);
    } catch {
      // ignore, still logout locally
    }

    setTimeout(() => showLoggedOut(), 300);
  }

  function togglePw() {
    const pw = el("password");
    pw.type = pw.type === "password" ? "text" : "password";
    el("togglePw").textContent = pw.type === "password" ? "Show" : "Hide";
  }

  document.addEventListener("DOMContentLoaded", () => {
    // optional: mark environment
    if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
      setText("envChip", "LOCAL");
    } else {
      setText("envChip", "DEPLOYED");
    }

    el("togglePw")?.addEventListener("click", togglePw);
    el("tabLogin")?.addEventListener("click", () => setMode("login"));
    el("tabRegister")?.addEventListener("click", () => setMode("register"));
    el("btnSubmit")?.addEventListener("click", handleSubmit);

    el("btnCheckMe")?.addEventListener("click", handleCheckMe);
    el("btnRenew")?.addEventListener("click", handleRenew);
    el("btnLogout")?.addEventListener("click", handleLogout);

    setMode("login");
    show("loggedInView", false);
    show("authView", true);

    stopCountdown();
    updateKidAndExpLabels(null);

    console.log("bundle initialized ✅");
  });
})();