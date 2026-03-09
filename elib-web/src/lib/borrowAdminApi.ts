import { getAccessToken, renewSession } from "./authApi";

function normalizeJwt(token: string) {
  const t = token.trim();
  return t.toLowerCase().startsWith("bearer ") ? t.slice(7).trim() : t;
}

async function authedFetch(path: string, init: RequestInit) {
  const t0 = getAccessToken();
  if (!t0) throw new Error("Not authenticated.");

  const token = normalizeJwt(t0);
  let res = await fetch(path, {
    ...init,
    headers: { ...(init.headers as any), Authorization: `Bearer ${token}` },
    credentials: "include"
  });

  if (res.status === 401) {
    await renewSession();
    const t1 = getAccessToken();
    if (!t1) throw new Error("Session refresh failed.");
    const token2 = normalizeJwt(t1);

    res = await fetch(path, {
      ...init,
      headers: { ...(init.headers as any), Authorization: `Bearer ${token2}` },
      credentials: "include"
    });
  }

  return res;
}

export type BorrowSummary = {
  totalLoans: number;
  activeLoans: number;
  overdueLoans: number;
  topBorrowers: { userId: number; total: number }[];
};

export async function adminSummary(): Promise<BorrowSummary> {
  const res = await authedFetch("/api/borrow/borrow/admin/summary", { method: "GET" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}