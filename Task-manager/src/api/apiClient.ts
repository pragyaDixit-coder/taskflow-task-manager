// src/services/apiClient.ts
import apiFetch, { apiGet as httpGet, apiPost as httpPost, apiPut as httpPut, apiDelete as httpDelete } from "../utils/http";

/**
 * Base URL from .env (no trailing slash).
 * NOTE: apiFetch already reads VITE_API_BASE_URL, so this is informational only.
 */
export const API_BASE_URL = ((import.meta.env.VITE_API_BASE_URL as string) || "").replace(/\/$/, "");

/**
 * Normalize path so callers can use:
 *  - "/api/..."
 *  - "api/..."
 *  - or a full absolute URL ("http://localhost:5000/api/...")
 *
 * If an absolute URL is provided we return it unchanged.
 * If a relative path is provided we ensure it starts with a slash.
 */
function normalizePath(path: string) {
  if (!path) return "/";

  try {
    // If this constructs, it's an absolute URL — return as-is
    // (new URL will throw for relative strings)
    // eslint-disable-next-line no-new
    new URL(path);
    return path;
  } catch {
    return path.startsWith("/") ? path : `/${path}`;
  }
}

/**
 * Convenience wrapper around apiFetch for consistent usage across app.
 * Each method accepts an optional `opts` which is forwarded to apiFetch.
 * For typical calls you can keep using: apiClient.get('/api/...') etc.
 */
export const apiGet = async (path: string, opts: { timeoutMs?: number; parseJson?: boolean; headers?: Record<string, string> } = {}) => {
  const p = normalizePath(path);
  try {
    return await httpGet(p, { timeoutMs: opts.timeoutMs, parseJson: opts.parseJson, headers: opts.headers });
  } catch (err) {
    // rethrow so callers can inspect err.status / err.body
    throw err;
  }
};

export const apiPost = async (path: string, payload?: any, opts: { timeoutMs?: number; parseJson?: boolean; headers?: Record<string, string> } = {}) => {
  const p = normalizePath(path);
  try {
    return await httpPost(p, payload, { timeoutMs: opts.timeoutMs, parseJson: opts.parseJson, headers: opts.headers });
  } catch (err) {
    throw err;
  }
};

export const apiPut = async (path: string, payload?: any, opts: { timeoutMs?: number; parseJson?: boolean; headers?: Record<string, string> } = {}) => {
  const p = normalizePath(path);
  try {
    return await httpPut(p, payload, { timeoutMs: opts.timeoutMs, parseJson: opts.parseJson, headers: opts.headers });
  } catch (err) {
    throw err;
  }
};

/**
 * apiDelete supports both:
 *   apiDelete('/api/x') and apiDelete('/api/x', { body })
 */
export const apiDelete = async (path: string, payloadOrOpts?: any, maybeOpts: any = {}) => {
  const p = normalizePath(path);

  // If second arg looks like an options object (contains parseJson/timeoutMs/headers), treat as opts
  const looksLikeOpts = payloadOrOpts && (payloadOrOpts.parseJson !== undefined || payloadOrOpts.timeoutMs !== undefined || payloadOrOpts.headers !== undefined);

  const payload = looksLikeOpts ? undefined : payloadOrOpts;
  const opts = looksLikeOpts ? payloadOrOpts : maybeOpts;

  try {
    return await httpDelete(p, payload, { timeoutMs: opts.timeoutMs, parseJson: opts.parseJson, headers: opts.headers });
  } catch (err) {
    throw err;
  }
};

const apiClient = {
  baseUrl: API_BASE_URL,
  get: apiGet,
  post: apiPost,
  put: apiPut,
  delete: apiDelete,
};

export default apiClient;
