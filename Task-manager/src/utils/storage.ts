// src/utils/storage.ts
import apiClient from "../api/apiClient"; // apiClient should use src/utils/http.ts

export type AppUser = {
  _id?: string;                // 👈 ADD THIS (MongoDB primary id)

  id?: number | string;  
  firstName: string;
  lastName: string;
  email: string;
  address?: string;
  countryId?: string | number;
  stateId?: string | number;
  cityId?: string | number;
  zip?: string;
  avatarUrl?: string | null;
  isDeleted?: boolean;
  role?: string | null; // normalized single role (lowercase)
  roles?: string[] | null; // normalized roles array (lowercase) if present
  isAdmin?: boolean | null; // convenience boolean
  createdById?: string | number | null;
};

/* ---------------- In-memory caches ---------------- */
let cachedCurrentUser: AppUser | null = null;
let tokenCache: string | null = null;

/**
 * inFlightFetch: prevents duplicate concurrent requests for current user.
 * Holds a Promise while a fetch is ongoing; cleared on completion.
 */
let inFlightFetch: Promise<any> | null = null;

/* ---------------- Helpers ---------------- */

/**
 * normalizeRoleFields
 * Accepts many possible backend shapes and returns normalized role info:
 *  { role?: string|null, roles?: string[]|null, isAdmin?: boolean|null }
 */
function normalizeRoleFields(u: any): { role?: string | null; roles?: string[] | null; isAdmin?: boolean | null } {
  const out: { role?: string | null; roles?: string[] | null; isAdmin?: boolean | null } = {
    role: null,
    roles: null,
    isAdmin: null,
  };

  if (!u || typeof u !== "object") return out;

  // Direct role string
  if (typeof u.role === "string" && u.role.trim()) out.role = u.role.trim().toLowerCase();

  // Alternate single-role fields
  if (!out.role && typeof u.roleName === "string" && u.roleName.trim()) out.role = u.roleName.trim().toLowerCase();
  if (!out.role && typeof u.userType === "string" && u.userType.trim()) out.role = u.userType.trim().toLowerCase();

  // roles array
  if (Array.isArray(u.roles) && u.roles.length) {
    const normalized = u.roles
      .map((r: any) => (r == null ? "" : String(r).trim()))
      .filter(Boolean)
      .map((r: string) => r.toLowerCase());
    if (normalized.length) {
      out.roles = normalized;
      if (!out.role) out.role = normalized[0];
    }
  }

  // nested user object shapes
  if (u.user && typeof u.user === "object") {
    if (!out.role && typeof u.user.role === "string" && u.user.role.trim()) out.role = u.user.role.trim().toLowerCase();
    if (!out.roles && Array.isArray(u.user.roles) && u.user.roles.length) {
      const normalized = u.user.roles.map((r: any) => (r == null ? "" : String(r).trim().toLowerCase())).filter(Boolean);
      if (normalized.length) {
        out.roles = normalized;
        if (!out.role) out.role = normalized[0];
      }
    }
    if (out.isAdmin === null && typeof u.user.isAdmin === "boolean") out.isAdmin = u.user.isAdmin;
  }

  // boolean flags
  if (typeof u.isAdmin === "boolean") {
    out.isAdmin = u.isAdmin;
    if (out.isAdmin && !out.role) out.role = "admin";
  }
  if (typeof u.is_superuser === "boolean" && u.is_superuser) {
    out.isAdmin = true;
    if (!out.role) out.role = "admin";
  }

  // string flags like "true"/"1"/"yes"
  if (out.isAdmin === null && typeof u.isAdmin === "string") {
    const v = u.isAdmin.trim().toLowerCase();
    if (v === "true" || v === "1" || v === "yes") {
      out.isAdmin = true;
      if (!out.role) out.role = "admin";
    }
  }

  return out;
}

/**
 * normalizeUser
 * Converts backend response shapes into AppUser
 */
function normalizeUser(body: any): AppUser {
  const u = body?.user ?? body?.currentUser ?? body ?? {};

  const roleInfo = normalizeRoleFields(u);

  return {
    id:
      u.id ??
      u.userID ??
      u.UserID ??
      u._id ??
      (u.user && (u.user.id ?? u.user.userID)) ??
      "",
    firstName:
      u.firstName ?? u.user?.firstName ?? u.first_name ?? u.user?.first_name ?? "",
    lastName: u.lastName ?? u.user?.lastName ?? u.last_name ?? u.user?.last_name ?? "",
    email: u.email ?? u.user?.email ?? u.emailID ?? u.emailId ?? "",
    address: u.address ?? u.user?.address ?? u.addressLine ?? "",
    countryId:
      u.countryId ?? u.user?.countryId ?? u.countryID ?? u.country ?? undefined,
    stateId: u.stateId ?? u.user?.stateId ?? u.stateID ?? undefined,
    cityId: u.cityId ?? u.user?.cityId ?? u.cityID ?? undefined,
    zip: u.zip ?? u.user?.zip ?? u.zipCode ?? undefined,
    avatarUrl: u.avatarUrl ?? u.user?.avatarUrl ?? null,
    isDeleted: !!(u.isDeleted ?? u.user?.isDeleted),
    role: roleInfo.role ?? null,
    roles: roleInfo.roles ?? null,
    isAdmin: roleInfo.isAdmin ?? null,
    createdById: u.createdById ?? u.user?.createdById ?? null,
  };
}

/* ---------------- endpoint helpers ---------------- */

/**
 * tryEndpointsGet(paths)
 * Attempts the provided paths in order. If a call returns 404, continues to next.
 * Throws on other non-OK responses (401, 500, network errors) so callers can handle them.
 *
 * apiClient.get is expected to throw error objects with .status and .body when non-OK.
 */
async function tryEndpointsGet(paths: string[]) {
  let lastErr: any = null;
  for (const p of paths) {
    try {
      const res = await apiClient.get(p);
      return res;
    } catch (err: any) {
      lastErr = err;
      if (err?.status === 404) continue;
      throw err;
    }
  }
  throw lastErr ?? new Error("All endpoints failed");
}

async function tryEndpointsPost(paths: string[], payload?: any) {
  let lastErr: any = null;
  for (const p of paths) {
    try {
      const res = await apiClient.post(p, payload);
      return res;
    } catch (err: any) {
      lastErr = err;
      if (err?.status === 404) continue;
      throw err;
    }
  }
  throw lastErr ?? new Error("All endpoints failed");
}

/* ---------------- In-memory token helpers (NO persistence) ---------------- */

export const saveToken = (token: string): void => {
  tokenCache = token ?? null;
};

export const getToken = (): string | null => tokenCache;

export const removeToken = (): void => {
  tokenCache = null;
};

/* ---------------- Public API ---------------- */

/**
 * fetchCurrentUserFromServer
 * - Attempts several common "current user" endpoints.
 * - Deduplicates in-flight requests (inFlightFetch).
 * - Treats 401 Unauthorized as "no user" (returns null) and avoids noisy console.error.
 */
export const fetchCurrentUserFromServer = async (): Promise<AppUser | null> => {
  // Dedupe in-flight requests
  if (inFlightFetch) {
    try {
      const body = await inFlightFetch;
      if (!body) {
        cachedCurrentUser = null;
        return null;
      }
      const normalized = normalizeUser(body);
      cachedCurrentUser = normalized;
      return normalized;
    } catch (err) {
      cachedCurrentUser = null;
      return null;
    }
  }

  const paths = [
    "/api/UserManagement/CurrentUser/GetModel",
    "/api/UserManagement/CurrentUser",
    "/api/auth/me",
    "/auth/me",
  ];

  // Start the in-flight promise
  inFlightFetch = (async () => {
    try {
      const body = await tryEndpointsGet(paths);
      return body;
    } catch (err) {
      // bubble error to outer try/catch so it can handle 401 specially
      throw err;
    } finally {
      // ensure inFlightFetch cleared when this promise settles
      inFlightFetch = null;
    }
  })();

  try {
    const body = await inFlightFetch;
    if (!body) {
      cachedCurrentUser = null;
      return null;
    }
    const normalized = normalizeUser(body);
    cachedCurrentUser = normalized;
    return normalized;
  } catch (err: any) {
    // Expected: Unauthorized for public pages — treat as anonymous silently.
    if (err?.status === 401) {
      // debug (not error) to keep console quiet on public pages
      // eslint-disable-next-line no-console
      console.debug("storage.fetchCurrentUserFromServer -> 401 Unauthorized (treated as anonymous)");
      cachedCurrentUser = null;
      return null;
    }

    // Unexpected errors (network/5xx) — log for visibility
    // eslint-disable-next-line no-console
    console.error("storage.fetchCurrentUserFromServer -> error:", err);
    cachedCurrentUser = null;
    return null;
  }
};

/**
 * getCurrentUser - returns cached user or fetches from server.
 */
export const getCurrentUser = async (): Promise<AppUser | null> => {
  if (cachedCurrentUser) return cachedCurrentUser;
  return await fetchCurrentUserFromServer();
};

/**
 * login(credentials)
 * - Tries common login endpoints.
 * - Saves token in-memory if returned.
 * - If server sets cookie (HttpOnly), subsequent fetchCurrentUserFromServer() will pick it up.
 */
export const login = async (credentials: Record<string, any>): Promise<AppUser | null> => {
  const paths = [
    "/api/UserManagement/Authentication/Login",
    "/api/auth/login",
    "/auth/login",
    "/api/UserManagement/Login",
  ];

  try {
    const body = await tryEndpointsPost(paths, credentials);

    // If server included token in body, save in-memory (no persistence)
    const token = body?.AuthToken ?? body?.authToken ?? body?.token ?? body?.accessToken ?? null;
    if (token) {
      saveToken(String(token));
    }

    // If server returned user-like data in body, normalize & cache
    if (body && (body.user || body.currentUser || body.id || body.email)) {
      const normalized = normalizeUser(body);
      cachedCurrentUser = normalized;
      return normalized;
    }

    // Otherwise fallback to cookie-first fetch (server may have set HttpOnly session cookie)
    const fetched = await fetchCurrentUserFromServer();
    return fetched;
  } catch (err) {
    cachedCurrentUser = null;
    throw err;
  }
};

/**
 * logout - call server logout endpoints and clear caches
 */
export const logout = async (): Promise<boolean> => {
  const paths = ["/api/auth/logout", "/auth/logout", "/api/UserManagement/Authentication/Logout"];
  try {
    await tryEndpointsPost(paths, {});
    cachedCurrentUser = null;
    tokenCache = null;
    return true;
  } catch (err) {
    cachedCurrentUser = null;
    tokenCache = null;
    return false;
  }
};

export const clearCachedUser = (): void => {
  cachedCurrentUser = null;
};

export const getCurrentUserIdAsStringSync = (): string | undefined => {
  if (!cachedCurrentUser) return undefined;
  return cachedCurrentUser.id !== undefined && cachedCurrentUser.id !== null ? String(cachedCurrentUser.id) : undefined;
};

/* default export for compatibility */
export default {
  fetchCurrentUserFromServer,
  getCurrentUser,
  login,
  logout,
  clearCachedUser,
  getCurrentUserIdAsStringSync,
  saveToken,
  getToken,
  removeToken,
};
