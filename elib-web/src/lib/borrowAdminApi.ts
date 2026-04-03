import { getAccessToken, renewSession } from "./authApi";

export type BorrowSummary = {
  total: number;
  active: number;
  returned: number;
};

const BORROW_BASE = "/api/borrow";

async function httpError(res: Response) {
  const text = await res.text().catch(() => "");
  return `HTTP ${res.status}. ${text}`;
}

async function borrowFetch(path: string, init: RequestInit = {}) {
  const token = getAccessToken();
  if (!token) {
    throw new Error("Not authenticated (no access token). Please login again.");
  }

  const headers: Record<string, string> = {
    ...((init.headers as Record<string, string>) ?? {}),
    Authorization: `Bearer ${token}`
  };

  let res = await fetch(`${BORROW_BASE}${path}`, {
    ...init,
    headers,
    credentials: "include"
  });

  if (res.status === 401) {
    await renewSession();
    const token2 = getAccessToken();

    if (!token2) {
      throw new Error("Session refresh failed. Please login again.");
    }

    res = await fetch(`${BORROW_BASE}${path}`, {
      ...init,
      headers: {
        ...((init.headers as Record<string, string>) ?? {}),
        Authorization: `Bearer ${token2}`
      },
      credentials: "include"
    });
  }

  return res;
}

export async function adminSummary(): Promise<BorrowSummary> {
  const res = await borrowFetch(`/borrow/admin/summary`, {
    method: "GET"
  });

  if (!res.ok) {
    throw new Error(await httpError(res));
  }

  return res.json();
}