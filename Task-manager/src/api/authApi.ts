// src/api/authApi.ts
// Auth API helpers — cookie-first (credentials: "include") and robust error handling.
// Use this from frontend Login / Forgot / Reset / Register flows.

const rawBase = (import.meta.env.VITE_API_BASE_URL as string) || "http://localhost:5000";
// Normalize trailing slash and ensure /api prefix
const API_BASE = rawBase.replace(/\/+$/, "") + "/api";

/**
 * Safely parse response body as JSON when possible.
 * Returns null for empty body, or { raw: text } if non-JSON text.
 */
async function parseJsonSafe(res: Response) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

/**
 * handleResponse: normalize successful response or throw a normalized error.
 * Thrown error will be an Error with `.status` (number) and `.body` (parsed JSON | { raw } | null)
 */
async function handleResponse(res: Response) {
  const body = await parseJsonSafe(res);
  if (!res.ok) {
    const message = (body && ((body as any).message || (body as any).error)) || res.statusText || "Request failed";
    const err: any = new Error(message);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

/* -------------------- Auth endpoints -------------------- */

/**
 * Login
 * - body: { EmailID, Password, remember? }
 * - server should set HttpOnly cookie. We send credentials: "include" so browser accepts it.
 */
export async function loginApi(emailID: string, password: string, remember = false) {
  const res = await fetch(`${API_BASE}/UserManagement/Authentication/Login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ EmailID: emailID, Password: password, remember }),
  });
  return handleResponse(res);
}

/**
 * Get current user (cookie/token-based)
 */
export async function getCurrentUserApi() {
  const res = await fetch(`${API_BASE}/UserManagement/CurrentUser/GetModel`, {
    method: "GET",
    headers: { Accept: "application/json" },
    credentials: "include",
  });
  return handleResponse(res);
}

/**
 * Logout
 */
export async function logoutApi() {
  const res = await fetch(`${API_BASE}/UserManagement/Authentication/Logout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({}),
  });
  return handleResponse(res);
}

/* -------------------- Forgot / Reset Password -------------------- */

/**
 * Send reset password email
 * Backend expects: { EmailID, resetPageBaseUrl? }
 */
export async function sendResetPasswordCodeApi(emailID: string, resetPageBaseUrl?: string) {
  if (!emailID || !String(emailID).trim()) {
    throw new Error("emailID is required");
  }

  const resetBase = resetPageBaseUrl ?? (window?.location?.origin + "/resetpassword");

  try {
    if (typeof window !== "undefined" && (import.meta.env.MODE !== "production")) {
      // eslint-disable-next-line no-console
      console.debug("[authApi] sendResetPasswordCodeApi payload:", { EmailID: emailID, resetPageBaseUrl: resetBase });
    }

    const res = await fetch(`${API_BASE}/UserManagement/ForgotPassword/SendResetPasswordCode`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        EmailID: emailID,
        resetPageBaseUrl: resetBase,
      }),
    });
    return await handleResponse(res);
  } catch (err: any) {
    // If it's already our structured error, rethrow it so callers can inspect err.body / err.status
    if (err && (err.status || err.body)) throw err;

    // Network or unexpected error — create a consistent Error object with body/status
    const e = err instanceof Error ? err : new Error(String(err || "Network error"));
    (e as any).status = (e as any).status ?? 0;
    (e as any).body = (e as any).body ?? { message: e.message };
    throw e;
  }
}

/**
 * Validate reset password code
 * Backend supports: GET ?code=...
 */
export async function validateResetPasswordCodeApi(code: string) {
  if (!code || !String(code).trim()) {
    throw new Error("reset code is required");
  }

  const url = `${API_BASE}/UserManagement/ForgotPassword/ValidateResetPasswordCode?code=${encodeURIComponent(code)}`;

  try {
    if (typeof window !== "undefined" && (import.meta.env.MODE !== "production")) {
      // eslint-disable-next-line no-console
      console.debug("[authApi] validateResetPasswordCodeApi url:", url);
    }

    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      credentials: "include",
    });
    return await handleResponse(res);
  } catch (err: any) {
    if (err && (err.status || err.body)) throw err;

    const e = err instanceof Error ? err : new Error(String(err || "Network error"));
    (e as any).status = (e as any).status ?? 0;
    (e as any).body = (e as any).body ?? { message: e.message ?? "Network error" };
    throw e;
  }
}

/**
 * Reset password
 * Backend expects: { resetPasswordCode, password }
 *
 * Important:
 * - Validate arguments before calling
 * - Wrap fetch in try/catch to give clearer errors
 */
export async function resetPasswordApi(resetPasswordCode: string, newPassword: string) {
  if (!resetPasswordCode || !String(resetPasswordCode).trim()) {
    throw new Error("resetPasswordCode is required");
  }
  if (!newPassword || !String(newPassword).trim()) {
    throw new Error("newPassword is required");
  }

  // helpful debug in dev — comment out in production if noisy
  if (typeof window !== "undefined" && (import.meta.env.MODE !== "production")) {
    // eslint-disable-next-line no-console
    console.debug("[authApi] resetPasswordApi payload:", { resetPasswordCode, password: newPassword });
  }

  try {
    const res = await fetch(`${API_BASE}/UserManagement/ForgotPassword/ResetPassword`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        resetPasswordCode: String(resetPasswordCode).trim(),
        password: newPassword,
      }),
    });

    if (typeof window !== "undefined" && (import.meta.env.MODE !== "production")) {
      // eslint-disable-next-line no-console
      console.debug("[authApi] ResetPassword response status:", res.status);
    }

    return await handleResponse(res);
  } catch (err: any) {
    // If we already have a structured error from handleResponse, rethrow it intact
    if (err && (err.status || err.body)) throw err;

    // Network error or unexpected; create consistent error object
    if (err instanceof Error && err.message && err.message.includes("Failed to fetch")) {
      const networkErr: any = new Error("Network error: could not reach server. Check backend is running and CORS settings.");
      networkErr.status = 0;
      networkErr.body = { message: networkErr.message };
      throw networkErr;
    }

    const e = err instanceof Error ? err : new Error(String(err || "Network or server error while resetting password"));
    (e as any).status = (e as any).status ?? 0;
    (e as any).body = (e as any).body ?? { message: e.message ?? "Network or server error while resetting password" };
    throw e;
  }
}

/* ===========================
   REGISTER
   =========================== */

/**
 * Accept a flexible payload for registration.
 * We use Record<string, any> so adding fields (zipCodes, CountryID, etc.) won't break TypeScript.
 */
export async function registerUserApi(payload: Record<string, any>) {
  const res = await fetch(`${API_BASE}/UserManagement/UserRegistration`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

/* default export with named functions for easy import */
export default {
  loginApi,
  getCurrentUserApi,
  logoutApi,
  sendResetPasswordCodeApi,
  validateResetPasswordCodeApi,
  resetPasswordApi,
  registerUserApi,
};
