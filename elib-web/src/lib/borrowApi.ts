import { getAccessToken, renewSession } from "./authApi";

export type Loan = {
  id: number;
  bookId: number;
  borrowedAtUtc: string;
  dueAtUtc: string;
  returnedAtUtc?: string | null;
};

export type ActiveLoan = {
  bookId: number;
  borrowedAtUtc: string;
  dueAtUtc: string;
  isOverdue: boolean;
};

function normalizeJwt(token: string) {
  const t = token.trim();
  return t.toLowerCase().startsWith("bearer ") ? t.slice(7).trim() : t;
}

function normalizeArray<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object" && Array.isArray((data as any).value)) {
    return (data as any).value as T[];
  }
  return [];
}

async function authedFetch(path: string, init: RequestInit) {
  const t0 = getAccessToken();
  if (!t0) throw new Error("Not authenticated. Please login again.");

  const token = normalizeJwt(t0);
  let res = await fetch(path, {
    ...init,
    headers: { ...(init.headers as any), Authorization: `Bearer ${token}` },
    credentials: "include"
  });

  if (res.status === 401) {
    await renewSession();
    const t1 = getAccessToken();
    if (!t1) throw new Error("Session refresh failed. Please login again.");

    const token2 = normalizeJwt(t1);
    res = await fetch(path, {
      ...init,
      headers: { ...(init.headers as any), Authorization: `Bearer ${token2}` },
      credentials: "include"
    });
  }

  return res;
}

async function httpError(res: Response) {
  const text = await res.text().catch(() => "");
  return `HTTP ${res.status}. ${text}`;
}

export async function checkoutBook(bookId: number) {
  const res = await authedFetch(`/api/borrow/borrow/checkout/${bookId}`, { method: "POST" });
  if (!res.ok) throw new Error(await httpError(res));
  return res.json();
}

export async function returnBook(bookId: number) {
  const res = await authedFetch(`/api/borrow/borrow/return/${bookId}`, { method: "POST" });
  if (!res.ok) throw new Error(await httpError(res));
  return res.json();
}

export async function myLoans(): Promise<Loan[]> {
  const res = await authedFetch(`/api/borrow/borrow/my`, { method: "GET" });
  if (!res.ok) throw new Error(await httpError(res));
  const data = await res.json();
  return normalizeArray<Loan>(data);
}

export async function myActiveLoans(): Promise<ActiveLoan[]> {
  const res = await authedFetch(`/api/borrow/borrow/my/active`, { method: "GET" });
  if (!res.ok) throw new Error(await httpError(res));
  const data = await res.json();
  return normalizeArray<ActiveLoan>(data);
}