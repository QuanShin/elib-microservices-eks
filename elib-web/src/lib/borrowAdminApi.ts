import { authFetch } from "./authApi";

export type BorrowSummary = {
  total: number;
  active: number;
  returned: number;
};

async function httpError(res: Response) {
  const text = await res.text().catch(() => "");
  return `HTTP ${res.status}. ${text}`;
}

export async function adminSummary(): Promise<BorrowSummary> {
  const res = await authFetch("/api/borrow/borrow/admin/summary", {
    method: "GET"
  });

  if (!res.ok) {
    throw new Error(await httpError(res));
  }

  return res.json();
}