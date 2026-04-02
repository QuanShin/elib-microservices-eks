import { authFetch } from "./authApi";

export type BorrowSummary = {
  total: number;
  active: number;
  returned: number;
};

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
const BORROW_BASE = `${API_BASE}/borrow`;

async function httpError(res: Response) {
  const text = await res.text().catch(() => "");
  return `HTTP ${res.status}. ${text}`;
}

export async function adminSummary(): Promise<BorrowSummary> {
  const res = await authFetch(`${BORROW_BASE}/borrow/admin/summary`, {
    method: "GET"
  });

  if (!res.ok) throw new Error(await httpError(res));
  return res.json();
}