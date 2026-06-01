import { createMiddleware } from "@tanstack/react-start";

export const SIWE_JWT_STORAGE_KEY = "siwe_jwt";

// Client middleware: forwards the locally-stored SIWE JWT as a Bearer token
// on every server-fn call. Server-side middleware (requireSiwe) verifies it.
export const attachSiweJwt = createMiddleware({ type: "function" }).client(async ({ next }) => {
  let token: string | null = null;
  try {
    if (typeof window !== "undefined") {
      token = window.localStorage.getItem(SIWE_JWT_STORAGE_KEY);
    }
  } catch {}
  return next(token ? { headers: { Authorization: `Bearer ${token}` } } : undefined);
});
