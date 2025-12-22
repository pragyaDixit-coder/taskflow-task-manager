// src/utils/http.ts
export type ApiFetchOptions = RequestInit & { parseJson?: boolean; timeoutMs?: number };

const RAW_BASE = (import.meta.env.VITE_API_BASE_URL as string) || "";
// fallback to localhost if env not provided (safe for local dev)
const API_BASE_URL = RAW_BASE ? RAW_BASE.replace(/\/+$/, "") : "http://localhost:5000";

/** Type-guard for FormData */
function isFormData(v: any): v is FormData {
  return typeof FormData !== "undefined" && v instanceof FormData;
}

/** Small timeout helper */
function timeoutPromise<T>(p: Promise<T>, ms?: number): Promise<T> {
  if (!ms || ms <= 0) return p;
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => {
      reject(new Error(`Request timed out after ${ms} ms`));
    }, ms);
    p.then((val) => {
      clearTimeout(t);
      resolve(val);
    }, (err) => {
      clearTimeout(t);
      reject(err);
    });
  });
}

/**
 * Core fetch wrapper used across the app.
 * - Uses credentials: "include" so cookies (HttpOnly) are sent automatically
 * - Normalizes headers/body and throws structured errors with .status and .body
 *
 * path: absolute path or relative (leading slash optional). Example: "/api/foo" or "api/foo"
 */
export async function apiFetch(path: string, opts: ApiFetchOptions = {}) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const base = API_BASE_URL;
  const url = `${base}${normalizedPath}`;

  // Normalize incoming headers to strings (don't mutate opts.headers directly)
  const incomingHeaders = (opts.headers || {}) as Record<string, any>;
  const headers: Record<string, string> = {
    Accept: "application/json",
    // copy incoming headers (stringify values)
    ...Object.fromEntries(
      Object.entries(incomingHeaders || {}).map(([k, v]) => [k, v == null ? "" : String(v)])
    ),
  };

  // Prepare body:
  let body: BodyInit | undefined = (opts.body as any) ?? undefined;
  // If body is JS object (and not FormData/string), stringify it and set content-type
  if (body !== undefined && !isFormData(body) && typeof body === "object") {
    if (typeof body !== "string") {
      body = JSON.stringify(body);
      if (!headers["Content-Type"]) headers["Content-Type"] = "application/json";
    }
  }

  // If FormData, remove Content-Type to allow browser to set multipart boundary
  if (isFormData(body)) {
    delete headers["Content-Type"];
  }

  const method = (opts.method ?? "GET").toUpperCase();
  const finalBody = method === "GET" || method === "HEAD" ? undefined : body;

  const fetchOpts: RequestInit = {
    ...opts,
    method,
    credentials: "include", // IMPORTANT: send cookies for cookie-based auth
    headers,
    body: finalBody,
  };

  // Keep parseJson option; default true
  const parseJson = opts.parseJson === false ? false : true;
  const timeoutMs = opts.timeoutMs ?? 0;

  let res: Response;
  try {
    // apply timeout wrapper if requested
    res = await timeoutPromise(fetch(url, fetchOpts), timeoutMs);
  } catch (networkErr: any) {
    // network-level error or timeout
    const e: any = new Error(networkErr?.message ?? "Network request failed");
    e.status = 0;
    e.body = null;
    e.url = url;
    e.method = method;
    throw e;
  }

  // Handle non-OK responses with structured error
  if (!res.ok) {
    let errBody: any = null;
    try {
      const text = await res.text();
      try {
        errBody = text ? JSON.parse(text) : null;
      } catch {
        errBody = text || null;
      }
    } catch {
      errBody = null;
    }

    const message =
      (errBody && (errBody.message || errBody.error)) ||
      res.statusText ||
      `Request failed with status ${res.status}`;

    const e: any = new Error(message);
    e.status = res.status;
    e.body = errBody;
    e.url = url;
    e.method = method;
    throw e;
  }

  // No content
  if (res.status === 204 || parseJson === false) {
    if (parseJson === false) return res;
    return null;
  }

  // Try to parse JSON; if parse fails return null
  try {
    return await res.json();
  } catch {
    return null;
  }
}

/* Convenience helpers for common verbs (typed) */
export async function apiGet(path: string, opts: ApiFetchOptions = {}) {
  return apiFetch(path, { ...opts, method: "GET" });
}

export async function apiPost(path: string, body?: any, opts: ApiFetchOptions = {}) {
  return apiFetch(path, { ...opts, method: "POST", body });
}

export async function apiPut(path: string, body?: any, opts: ApiFetchOptions = {}) {
  return apiFetch(path, { ...opts, method: "PUT", body });
}

export async function apiDelete(path: string, body?: any, opts: ApiFetchOptions = {}) {
  // some backends expect body with delete, some don't — allow both
  return apiFetch(path, { ...opts, method: "DELETE", body });
}

export default apiFetch;
