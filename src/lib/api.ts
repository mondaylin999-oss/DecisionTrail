"use client";
/** Fetch wrapper for our own API: attaches the Firebase ID token and App Check token. */
import { appCheckHeader, firebaseAuth } from "./firebase/client";

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export async function api<T = unknown>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const user = firebaseAuth().currentUser;
  if (!user) throw new ApiError("Not signed in", 401);
  const token = await user.getIdToken();
  const res = await fetch(path, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(await appCheckHeader()),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError((json as { error?: string }).error ?? res.statusText, res.status);
  return json as T;
}
