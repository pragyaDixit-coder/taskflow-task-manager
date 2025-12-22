// src/api/userApi.ts
// Hinglish: ye file sirf user se related API calls ke liye hai
// (current user profile, duplicate email check, update profile, etc.)

import apiClient from "./apiClient";

type Maybe<T> = T | null | undefined;

export type CurrentUserModel = {
  userID?: string;
  firstName?: string;
  lastName?: string;
  emailID?: string;
  address?: string;
  countryName?: string;
  stateName?: string;
  cityName?: string;
  zipCode?: string;
  avatarUrl?: string | null;
  role?: string;
  [k: string]: any;
};

type UpdateCurrentUserPayload = {
  FirstName: string;
  LastName: string;
  EmailID: string;
  Address?: string;
  CountryName?: string;
  StateName?: string;
  CityName?: string;
  Zip?: string;
  // allow extra fields such as AvatarUrl if frontend sends it
  [k: string]: any;
};

function makeError(err: any, fallbackMessage = "Request failed") {
  const msg = err?.message || fallbackMessage;
  const e: any = new Error(msg);
  e.status = err?.status ?? err?.statusCode ?? null;
  e.body = err?.body ?? err?.data ?? null;
  return e;
}

/**
 * Prefix used for backend routes. If your backend does NOT use /api prefix,
 * change or remove this constant.
 */
const PREFIX = "/api";

/**
 * tryEndpoints attempts endpoints in order until one succeeds.
 * It returns the parsed body of the first successful response,
 * or throws the last error.
 */
async function tryEndpointsGet(paths: string[]) {
  let lastErr: any = null;
  for (const p of paths) {
    try {
      const res = await apiClient.get(p);
      return res;
    } catch (err: any) {
      lastErr = err;
      // Continue on 404 (endpoint not present). For other errors rethrow.
      if (err?.status === 404) continue;
      throw err;
    }
  }
  throw lastErr ?? new Error("All endpoints failed");
}

/**
 * 1) Get current user model
 * Attempts several well-known routes so the frontend works with multiple backends.
 */
export const getCurrentUserApi = async (): Promise<Maybe<CurrentUserModel>> => {
  try {
    // try common endpoints in order (adjust if your backend differs)
    const candidates = [
      `${PREFIX}/UserManagement/CurrentUser/GetModel`,
      `${PREFIX}/UserManagement/CurrentUser`, // sometimes used
      `${PREFIX}/auth/me`,
      `${PREFIX}/auth/current-user`,
      `/UserManagement/CurrentUser/GetModel`, // fallback without /api if apiClient base handling differs
      `/api/auth/me`,
    ];
    const body = await tryEndpointsGet(candidates);
    return (body as CurrentUserModel) ?? null;
  } catch (err: any) {
    // If 401 treat as anonymous (return null) so callers can handle unauthenticated state
    if (err?.status === 401) return null;
    throw makeError(err, "Failed to load current user");
  }
};

/**
 * 2) Update current user
 * PUT /api/UserManagement/CurrentUser/Update
 */
export const updateCurrentUserApi = async (payload: UpdateCurrentUserPayload) => {
  try {
    const path = `${PREFIX}/UserManagement/CurrentUser/Update`;
    const body = await apiClient.put(path, payload);
    return body;
  } catch (err: any) {
    throw makeError(err, "Failed to update user");
  }
};

/**
 * 3) Check duplicate email
 * POST /api/UserManagement/CurrentUser/CheckDuplicateEmailID
 * Server may either return { isDuplicate: boolean } or throw 409 on duplicate.
 */
export const checkDuplicateEmailApi = async (emailID: string) => {
  try {
    const path = `${PREFIX}/UserManagement/CurrentUser/CheckDuplicateEmailID`;
    const body = await apiClient.post(path, { EmailID: emailID });
    return body;
  } catch (err: any) {
    throw makeError(err, "Email check failed");
  }
};

export default {
  getCurrentUserApi,
  updateCurrentUserApi,
  checkDuplicateEmailApi,
};
