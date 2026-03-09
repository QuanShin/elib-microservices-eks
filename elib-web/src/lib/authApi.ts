export type LoginResponse = {
  accessToken: string;
  expiresIn: number;
  csrfToken: string;
};

export type MeResponse = { sub: string; email: string; role: string };

let accessToken: string | null = null;

// read csrf from cookie (always reliable as long as cookie exists)
function getCsrfFromCookie() {
  const m = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export function getAccessToken() {
  return accessToken;
}

export function clearSession() {
  accessToken = null;
}

async function safeError(res: Response) {
  try {
    const data = await res.json();
    return data.error || data.message || `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

async function request(path: string, init: RequestInit = {}, opts?: { useCsrf?: boolean }) {
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string> ?? {})
  };

  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

  if (opts?.useCsrf) {
    const csrf = getCsrfFromCookie();
    if (csrf) headers["X-CSRF"] = csrf;
  }

  return fetch(`/api/auth${path}`, {
    ...init,
    headers,
    credentials: "include"
  });
}

export async function register(email: string, password: string) {
  const res = await request("/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, role: "MEMBER" })
  });
  if (!res.ok) throw new Error(await safeError(res));
  return res.json();
}

export async function login(email: string, password: string) {
  const res = await request("/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  if (!res.ok) throw new Error(await safeError(res));

  const data = (await res.json()) as LoginResponse;
  accessToken = data.accessToken;
  return data;
}

export async function checkMeNoRefresh(): Promise<MeResponse> {
  const res = await request("/me");
  if (!res.ok) throw new Error(await safeError(res));
  return res.json();
}

// ✅ refresh works even after reload (csrf read from cookie)
export async function renewSession() {
  const res = await request("/refresh", { method: "POST" }, { useCsrf: true });
  if (!res.ok) throw new Error(await safeError(res));
  const data = await res.json();
  accessToken = data.accessToken;
  return data;
}

export async function logout() {
  // logout needs CSRF too
  const res = await request("/logout", { method: "POST" }, { useCsrf: true });
  clearSession();
  if (!res.ok) throw new Error(await safeError(res));
  return res.json();
}