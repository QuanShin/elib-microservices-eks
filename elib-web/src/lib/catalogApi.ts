import { authFetch, getAccessToken, renewSession } from "./authApi";

export type BookListItem = {
  id: number;
  title: string;
  author: string;
  category: string;
  year: number;
  publisher?: string | null;
  price?: number | null;
  publishMonth?: string | null;
};

export type Book = BookListItem & {
  description?: string | null;
  isbn?: string | null;
  createdAtUtc?: string;
};

export type BookCreate = {
  title: string;
  author: string;
  category: string;
  year: number;
  description?: string;
  publisher?: string;
  price?: number;
  publishMonth?: string;
  isbn?: string;
};

async function httpError(res: Response) {
  const text = await res.text().catch(() => "");
  return `HTTP ${res.status}. ${text}`;
}

// Keep old helper name so old code keeps working.
async function authedFetch(path: string, init: RequestInit) {
  const token = getAccessToken();
  if (!token) throw new Error("Not authenticated (no access token). Please login again.");

  const headers: Record<string, string> = {
    ...((init.headers as any) ?? {}),
    Authorization: `Bearer ${token}`
  };

  let res = await fetch(path, { ...init, headers, credentials: "include" });

  if (res.status === 401) {
    await renewSession();
    const token2 = getAccessToken();
    if (!token2) throw new Error("Session refresh failed. Please login again.");

    res = await fetch(path, {
      ...init,
      headers: { ...((init.headers as any) ?? {}), Authorization: `Bearer ${token2}` },
      credentials: "include"
    });
  }

  return res;
}

// Old name preserved.
export async function listBooks(): Promise<BookListItem[]> {
  const res = await fetch("/api/catalog/catalog/books", { credentials: "include" });
  if (!res.ok) throw new Error(`Catalog HTTP ${res.status}`);
  return res.json();
}

// New helper if you want search.
export async function searchBooks(query?: string, category?: string): Promise<BookListItem[]> {
  const params = new URLSearchParams();
  if (query) params.set("query", query);
  if (category) params.set("category", category);

  const suffix = params.toString() ? `?${params.toString()}` : "";
  const res = await fetch(`/api/catalog/catalog/books${suffix}`, { credentials: "include" });
  if (!res.ok) throw new Error(`Catalog HTTP ${res.status}`);
  return res.json();
}

export async function getBook(id: number): Promise<Book> {
  const res = await fetch(`/api/catalog/catalog/books/${id}`, { credentials: "include" });
  if (!res.ok) throw new Error(`Catalog HTTP ${res.status}`);
  return res.json();
}

export async function createBook(input: BookCreate): Promise<Book> {
  const res = await authedFetch("/api/catalog/catalog/books", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  if (!res.ok) throw new Error(await httpError(res));
  return res.json();
}

export async function updateBook(id: number, input: BookCreate): Promise<Book> {
  const res = await authedFetch(`/api/catalog/catalog/books/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  if (!res.ok) throw new Error(await httpError(res));
  return res.json();
}

export async function deleteBook(id: number): Promise<{ ok: boolean } | { message: string }> {
  const res = await authedFetch(`/api/catalog/catalog/books/${id}`, {
    method: "DELETE"
  });
  if (!res.ok) throw new Error(await httpError(res));
  return res.json();
}

export async function uploadBooksCsv(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const res = await authFetch("/api/catalog/catalog/books/import", {
    method: "POST",
    body: formData
  });

  if (!res.ok) throw new Error(await httpError(res));
  return res.json();
}