import { authFetch } from "./authApi";

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

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
const BORROW_BASE = `${API_BASE}/borrow`;

async function httpError(res: Response) {
  const text = await res.text().catch(() => "");
  return `HTTP ${res.status}. ${text}`;
}

export async function checkoutBook(bookId: number): Promise<CheckoutResult> {
  const res = await authFetch(`${BORROW_BASE}/borrow/checkout/${bookId}`, {
    method: "POST"
  });

  if (!res.ok) throw new Error(await httpError(res));
  return res.json();
}

export async function returnBook(loanId: number): Promise<{ ok: boolean }> {
  const res = await authFetch(`${BORROW_BASE}/borrow/return/${loanId}`, {
    method: "POST"
  });

  if (!res.ok) throw new Error(await httpError(res));
  return res.json();
}

export async function returnLoan(loanId: number): Promise<{ ok: boolean }> {
  return returnBook(loanId);
}

export async function myLoans(): Promise<Loan[]> {
  const res = await authFetch(`${BORROW_BASE}/borrow/my-loans`, {
    method: "GET"
  });

  if (!res.ok) throw new Error(await httpError(res));

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