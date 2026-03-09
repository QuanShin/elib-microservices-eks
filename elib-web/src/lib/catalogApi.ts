import { getAccessToken, renewSession } from "./authApi";

export type BookListItem = {
  id: number;
  title: string;
  author: string;
  category: string;
  year: number;
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
  isbn?: string;
};

async function httpError(res: Response) {
  const text = await res.text().catch(() => "");
  return `HTTP ${res.status}. ${text}`;
}

async function authedFetch(path: string, init: RequestInit) {
  const token = getAccessToken();
  if (!token) throw new Error("Not authenticated (no access token). Please login again.");

  const headers: Record<string, string> = {
    ...(init.headers as any),
    Authorization: `Bearer ${token}`
  };

  let res = await fetch(path, { ...init, headers });

  if (res.status === 401) {
    await renewSession();
    const token2 = getAccessToken();
    if (!token2) throw new Error("Session refresh failed. Please login again.");

    res = await fetch(path, {
      ...init,
      headers: { ...(init.headers as any), Authorization: `Bearer ${token2}` }
    });
  }

  return res;
}

export async function listBooks(): Promise<BookListItem[]> {
  const res = await fetch("/api/catalog/catalog/books");
  if (!res.ok) throw new Error(`Catalog HTTP ${res.status}`);
  return res.json();
}

export async function getBook(id: number): Promise<Book> {
  const res = await fetch(`/api/catalog/catalog/books/${id}`);
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

export async function deleteBook(id: number): Promise<{ message: string }> {
  const res = await authedFetch(`/api/catalog/catalog/books/${id}`, {
    method: "DELETE"
  });
  if (!res.ok) throw new Error(await httpError(res));
  return res.json();
}