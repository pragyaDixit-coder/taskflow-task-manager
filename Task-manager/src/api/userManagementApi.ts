// src/api/userManagementApi.ts
// Hinglish: User management (admin user list + add/edit/delete) ke liye API helpers
// Uses centralized apiClient for headers, error handling and base URL.

import apiClient from "./apiClient";

/* -----------------------------
   Payload / response interfaces
   ----------------------------- */

export interface UserInsertPayload {
  FirstName: string;
  LastName: string;
  EmailID: string;
  Password: string;
  Address: string;
  CountryName: string;
  StateName: string;
  CityName: string;
  Zip: string;
  AvatarUrl?: string;
}

export interface UserUpdatePayload {
  UserID: string;
  FirstName: string;
  LastName: string;
  EmailID: string;
  Password?: string; // only if UpdatePassword = true
  Address: string;
  CountryName: string;
  StateName: string;
  CityName: string;
  Zip: string;
  UpdatePassword: boolean;
  AvatarUrl?: string;
}

/* -----------------------------
   Helpers: path normalization + fallback
   ----------------------------- */

/**
 * If path already starts with /api/ leave as-is.
 * If absolute url (http/https) leave as-is.
 * Otherwise ensure it has a leading slash and prepend /api.
 */
function ensureApiPath(path: string): string {
  if (!path) return "/api";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const p = path.startsWith("/") ? path : `/${path}`;
  if (p.startsWith("/api/")) return p;
  return `/api${p}`;
}

/**
 * Try call with primaryPath (usually ensureApiPath(path))
 * If that returns a 404/400, try fallbackPath (usually original path without /api).
 *
 * The caller supplies a `call` function which actually performs apiClient.get/post/put/delete.
 */
async function tryWithFallback<T>(
  primaryPath: string,
  fallbackPath: string | null,
  call: (p: string) => Promise<T>
): Promise<T> {
  let lastErr: any = null;

  try {
    return await call(primaryPath);
  } catch (err: any) {
    lastErr = err;
    // if 404/400 and fallback available, try fallback
    const status = err?.status ?? err?.response?.status ?? null;
    if ((status === 404 || status === 400) && fallbackPath) {
      try {
        return await call(fallbackPath);
      } catch (err2: any) {
        lastErr = err2;
      }
    }
  }

  // build structured error to rethrow (preserve message/body/status)
  const message = lastErr?.message ?? (lastErr?.body?.message) ?? (lastErr?.response?.data?.message) ?? "Request failed";
  const re: any = new Error(message);
  re.status = lastErr?.status ?? lastErr?.response?.status ?? null;
  re.body = lastErr?.body ?? lastErr?.response?.data ?? lastErr;
  throw re;
}

/* -----------------------------
   Low-level request helpers
   These try both "/api/..." and "/..." (fallback) automatically.
   ----------------------------- */

async function doGet<T = any>(rawPath: string): Promise<T> {
  const primary = ensureApiPath(rawPath);
  const fallback = (() => {
    if (rawPath.startsWith("/api/")) return rawPath.replace(/^\/api/, "");
    if (!rawPath.startsWith("/")) return `/${rawPath}`;
    return rawPath;
  })();

  return tryWithFallback<T>(primary, fallback, async (p) => {
    const res = await apiClient.get(p);
    return res.data ?? res;
  });
}

async function doPost<T = any>(rawPath: string, payload?: any): Promise<T> {
  const primary = ensureApiPath(rawPath);
  const fallback = (() => {
    if (rawPath.startsWith("/api/")) return rawPath.replace(/^\/api/, "");
    if (!rawPath.startsWith("/")) return `/${rawPath}`;
    return rawPath;
  })();

  return tryWithFallback<T>(primary, fallback, async (p) => {
    const res = await apiClient.post(p, payload);
    return res.data ?? res;
  });
}

async function doPut<T = any>(rawPath: string, payload?: any): Promise<T> {
  const primary = ensureApiPath(rawPath);
  const fallback = (() => {
    if (rawPath.startsWith("/api/")) return rawPath.replace(/^\/api/, "");
    if (!rawPath.startsWith("/")) return `/${rawPath}`;
    return rawPath;
  })();

  return tryWithFallback<T>(primary, fallback, async (p) => {
    const res = await apiClient.put(p, payload);
    return res.data ?? res;
  });
}

async function doDelete<T = any>(rawPath: string): Promise<T> {
  const primary = ensureApiPath(rawPath);
  const fallback = (() => {
    if (rawPath.startsWith("/api/")) return rawPath.replace(/^\/api/, "");
    if (!rawPath.startsWith("/")) return `/${rawPath}`;
    return rawPath;
  })();

  return tryWithFallback<T>(primary, fallback, async (p) => {
    const res = await apiClient.delete(p);
    return res.data ?? res;
  });
}

/* -----------------------------
   Utility: sanitize payloads (only allow backend-expected flat keys)
   ----------------------------- */

function sanitizeUpdatePayload(payload: any): any {
  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid payload");
  }

  const allowed = new Set([
    "UserID",
    "FirstName",
    "LastName",
    "EmailID",
    "Password",
    "Address",
    "CountryName",
    "StateName",
    "CityName",
    "Zip",
    "UpdatePassword",
    "AvatarUrl",
  ]);

  // Map common alternative keys to backend names
  const mapper: Record<string, string> = {
    userID: "UserID",
    userId: "UserID",
    id: "UserID",
    mongoId: "UserID",
    firstName: "FirstName",
    lastName: "LastName",
    email: "EmailID",
    emailID: "EmailID",
    address: "Address",
    countryName: "CountryName",
    stateName: "StateName",
    cityName: "CityName",
    zip: "Zip",
    updatePassword: "UpdatePassword",
    avatarUrl: "AvatarUrl",
    Password: "Password",
    password: "Password",
  };

  const out: any = {};
  for (const [k, v] of Object.entries(payload)) {
    const key = mapper[k] ?? k;
    if (allowed.has(key)) {
      out[key] = v;
    }
  }

  // required small validation
  if (!out.UserID) {
    throw new Error("UserID is required in update payload");
  }

  // Normalize empty strings -> null for fields where backend might prefer null
  for (const k of Object.keys(out)) {
    if (typeof out[k] === "string" && out[k].trim() === "") out[k] = null;
  }

  // Ensure UpdatePassword boolean
  if ("UpdatePassword" in out) {
    out.UpdatePassword = Boolean(out.UpdatePassword);
  } else {
    out.UpdatePassword = false;
  }

  return out;
}

/* -----------------------------
   Public API helpers
   ----------------------------- */

/**
 * Get users list.
 * Many backends implement "GetList" as POST with optional filters.
 */
export const getUsersApi = async (filters: Record<string, any> = {}): Promise<any> => {
  try {
    // prefer POST for GetList endpoints
    const body = await doPost("/UserManagement/User/GetList", filters ?? {});
    return body;
  } catch (err: any) {
    const e: any = new Error(err?.message ?? "Failed to load users");
    e.status = err?.status;
    e.body = err?.body;
    throw e;
  }
};

export const deleteUserApi = async (id: string): Promise<any> => {
  if (!id) throw new Error("User id required.");
  try {
    const body = await doDelete(`/UserManagement/User/Delete/${encodeURIComponent(id)}`);
    return body;
  } catch (err: any) {
    // preserve backend message (e.g. "User has assigned tasks") for frontend toast
    const message = err?.body?.message ?? err?.message ?? "Failed to delete user";
    const e: any = new Error(message);
    e.status = err?.status;
    e.body = err?.body ?? err;
    throw e;
  }
};

export const insertUserApi = async (payload: UserInsertPayload): Promise<any> => {
  try {
    const sanitized: any = {};
    // pick only allowed fields (simple defensiveness)
    sanitized.FirstName = (payload.FirstName ?? "").trim();
    sanitized.LastName = (payload.LastName ?? "").trim();
    sanitized.EmailID = (payload.EmailID ?? "").trim();
    sanitized.Password = payload.Password ?? "";
    sanitized.Address = payload.Address ?? null;
    sanitized.CountryName = payload.CountryName ?? null;
    sanitized.StateName = payload.StateName ?? null;
    sanitized.CityName = payload.CityName ?? null;
    sanitized.Zip = payload.Zip ?? null;
    sanitized.AvatarUrl = payload.AvatarUrl ?? null;

    const body = await doPost("/UserManagement/User/Insert", sanitized);
    return body;
  } catch (err: any) {
    const e: any = new Error(err?.message ?? "Failed to add user");
    e.status = err?.status;
    e.body = err?.body;
    throw e;
  }
};

export const updateUserApi = async (payload: UserUpdatePayload | any): Promise<any> => {
  try {
    // sanitize + map keys so we don't send nested/conflicting fields
    const sanitized = sanitizeUpdatePayload(payload);

    // Some backends accept PUT /User/Update, some accept POST - doPut does fallback logic already
    const body = await doPut("/UserManagement/User/Update", sanitized);
    return body;
  } catch (err: any) {
    // preserve detailed error for frontend
    const message = err?.body?.message ?? err?.message ?? "Failed to update user";
    const e: any = new Error(message);
    e.status = err?.status;
    e.body = err?.body ?? err;
    throw e;
  }
};

export const getUserModelApi = async (id: string): Promise<any> => {
  if (!id) throw new Error("id required");
  try {
    const body = await doGet(`/UserManagement/User/GetModel/${encodeURIComponent(id)}`);
    return body;
  } catch (err: any) {
    const e: any = new Error(err?.message ?? "Failed to load user detail");
    e.status = err?.status;
    e.body = err?.body;
    throw e;
  }
};

export const checkDuplicateEmailForUserApi = async (EmailID: string, ExcludeID?: string): Promise<any> => {
  try {
    const body = await doPost("/UserManagement/User/CheckDuplicateEmailID", {
      EmailID,
      ExcludeID,
    });
    return body;
  } catch (err: any) {
    const e: any = new Error(err?.message ?? "Email check failed");
    e.status = err?.status;
    e.body = err?.body;
    throw e;
  }
};

/* default export (compat) */
export default {
  getUsersApi,
  deleteUserApi,
  insertUserApi,
  updateUserApi,
  getUserModelApi,
  checkDuplicateEmailForUserApi,
};
