import { getAccessToken, renewSession } from "./authApi";

export type Loan = {
  id: number;
  userId?: number;
  bookId: number;
  borrowedAtUtc: string;
  dueAtUtc: string;
  returnedAtUtc?: string | null;
};

export type ActiveLoan = {
  id?: number;
  bookId: number;
  borrowedAtUtc: string;
  dueAtUtc: string;
  isOverdue?: boolean;
  returnedAtUtc?: string | null;
};

export type CheckoutResult = {
  id: number;
  bookId: number;
  dueAtUtc: string;
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

export async function checkoutBook(bookId: number): Promise<CheckoutResult> {
  const res = await borrowFetch(`/borrow/checkout/${bookId}`, {
    method: "POST"
  });

  if (!res.ok) {
    throw new Error(await httpError(res));
  }

  return res.json();
}

export async function returnBook(loanId: number): Promise<{ ok: boolean }> {
  const res = await borrowFetch(`/borrow/return/${loanId}`, {
    method: "POST"
  });

  if (!res.ok) {
    throw new Error(await httpError(res));
  }

  return res.json();
}

export async function returnLoan(loanId: number): Promise<{ ok: boolean }> {
  return returnBook(loanId);
}

export async function myLoans(): Promise<Loan[]> {
  const res = await borrowFetch(`/borrow/my-loans`, {
    method: "GET"
  });

  if (!res.ok) {
    throw new Error(await httpError(res));
  }

  const data = await res.json();
  return Array.isArray(data) ? (data as Loan[]) : [];
}

export async function myActiveLoans(): Promise<ActiveLoan[]> {
  const loans = await myLoans();

  return loans
    .filter((x) => !x.returnedAtUtc)
    .map((x) => ({
      id: x.id,
      bookId: x.bookId,
      borrowedAtUtc: x.borrowedAtUtc,
      dueAtUtc: x.dueAtUtc,
      isOverdue: new Date(x.dueAtUtc).getTime() < Date.now(),
      returnedAtUtc: x.returnedAtUtc ?? null
    }));
}