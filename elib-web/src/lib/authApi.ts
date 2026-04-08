export type LoginResponse = {
  accessToken: string;
  csrfToken: string;
  user: {
    id: number;
    email: string;
    role: string;
  };
};

export type MeResponse = {
  sub: string;
  email: string;
  role: string;
};

const AUTH_BASE = "/api/auth";
const ACCESS_TOKEN_KEY = "elib_access_token";

let accessToken: string | null = localStorage.getItem(ACCESS_TOKEN_KEY);

function getCsrfFromCookie() {
  const m = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

function setAccessToken(token: string | null) {
  accessToken = token;
  if (token) {
    localStorage.setItem(ACCESS_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
  }
}

export function getAccessToken() {
  return accessToken;
}

export function clearSession() {
  setAccessToken(null);
}

export function restoreSession() {
  accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
  return accessToken;
}

async function safeError(res: Response) {
  try {
    const data = await res.json();
    if (res.status === 401) return "Invalid email or password.";
    if (res.status === 403) return data.error || data.message || "Access denied.";
    if (res.status === 404) return data.error || data.message || "Requested resource was not found.";
    return data.error || data.message || `HTTP ${res.status}`;
  } catch {
    if (res.status === 401) return "Invalid email or password.";
    if (res.status === 403) return "Access denied.";
    if (res.status === 404) return "Requested resource was not found.";
    return `HTTP ${res.status}`;
  }
}

async function request(
  path: string,
  init: RequestInit = {},
  opts?: { useCsrf?: boolean }
) {
  const headers: Record<string, string> = {
    ...((init.headers as Record<string, string>) ?? {})
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  if (opts?.useCsrf) {
    const csrf = getCsrfFromCookie();
    if (csrf) {
      headers["X-CSRF"] = csrf;
    }
  }

  return fetch(`${AUTH_BASE}${path}`, {
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

  if (!res.ok) {
    throw new Error(await safeError(res));
  }

  return res.json();
}

export async function login(email: string, password: string) {
  const res = await request("/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });

  if (!res.ok) {
    throw new Error(await safeError(res));
  }

  const data = (await res.json()) as LoginResponse;
  setAccessToken(data.accessToken);
  return data;
}

export async function checkMeNoRefresh(): Promise<MeResponse> {
  const res = await request("/me");

  if (!res.ok) {
    throw new Error(await safeError(res));
  }

  return res.json();
}

export async function renewSession() {
  const res = await request(
    "/refresh",
    { method: "POST" },
    { useCsrf: true }
  );

  if (!res.ok) {
    throw new Error(await safeError(res));
  }

  const data = await res.json();
  setAccessToken(data.accessToken);
  return data;
}

export async function logout() {
  const res = await request(
    "/logout",
    { method: "POST" },
    { useCsrf: true }
  );

  clearSession();

  if (!res.ok) {
    throw new Error(await safeError(res));
  }

  return res.json();
}

export async function authFetch(
  path: string,
  init: RequestInit = {},
  opts?: { useCsrf?: boolean }
) {
  let res = await request(path, init, opts);

  if (res.status === 401) {
    try {
      await renewSession();
      res = await request(path, init, opts);
    } catch {
      clearSession();
    }
  }

  return res;
}