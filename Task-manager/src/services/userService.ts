// src/services/userService.ts
// Backend-backed user service (replaces previous localStorage mock).
// Uses apiFetch so credentials (cookies) and in-memory token are handled centrally.

import { AppUser } from "../utils/storage";
import { apiFetch } from "../utils/http";

/* ----------------------
   Backend ↔ Front mapping
   ---------------------- */

/**
 * Map backend user object (various shapes) to AppUser
 */
const mapBackendUser = (u: any): AppUser => {
  const user = u ?? {};
  const rawId =
    user.userID ??
    user.UserID ??
    user._id ??
    user.id ??
    (user.user && (user.user.id ?? user.user._id)) ??
    "";
  const createdByCandidate =
    user.createdBy ??
    user.createdById ??
    user.CreatedBy ??
    (user.createdBy && (user.createdBy._id ?? user.createdBy));

  return {
    id: String(rawId ?? ""),
    firstName:
      user.firstName ??
      user.user?.firstName ??
      user.first_name ??
      user.first ??
      "",
    lastName:
      user.lastName ?? user.user?.lastName ?? user.last_name ?? user.last ?? "",
    email:
      user.email ??
      user.user?.email ??
      user.emailID ??
      user.emailId ??
      user.EmailID ??
      "",
    address:
      user.address ?? user.user?.address ?? user.addressLine ?? user.Address ?? "",
    countryId:
      user.countryId ??
      user.user?.countryId ??
      user.countryID ??
      user.CountryID ??
      undefined,
    stateId:
      user.stateId ?? user.user?.stateId ?? user.stateID ?? user.StateID ?? undefined,
    cityId:
      user.cityId ?? user.user?.cityId ?? user.cityID ?? user.CityID ?? undefined,
    zip:
      user.zip ??
      user.user?.zip ??
      user.zipCode ??
      user.Zip ??
      user.zip_code ??
      undefined,
    avatarUrl:
      user.avatarUrl ?? user.user?.avatarUrl ?? user.profileImageUrl ?? null,
    isDeleted: !!(user.isDeleted ?? user.user?.isDeleted ?? user.IsDeleted),
    role:
      (user.role ??
        user.user?.role ??
        user.userType ??
        user.UserType ??
        (user.roles && Array.isArray(user.roles) ? user.roles[0] : undefined) ??
        "user") || "user",
    createdById: createdByCandidate ? String(createdByCandidate) : null,
  };
};

/* ----------------------
   Helpers
   ---------------------- */

function normalizeArrayResponse(raw: any): any[] {
  if (!raw) return [];
  // If backend wraps in { data: [...] } or { items: [...] } etc.
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw.data)) return raw.data;
  if (Array.isArray(raw.items)) return raw.items;
  if (Array.isArray(raw.Result)) return raw.Result;
  if (Array.isArray(raw.result)) return raw.result;
  // If response is an object with a top-level 'users' or 'items' field
  if (raw.users && Array.isArray(raw.users)) return raw.users;
  if (raw.results && Array.isArray(raw.results)) return raw.results;
  // If raw is an object representing a single user, return as array
  if (typeof raw === "object") return [raw];
  return [];
}

/* ----------------------
   Public service methods
   ---------------------- */

/**
 * getAllUsers
 * - Fetch list of users (active)
 * - Endpoint: POST /api/UserManagement/User/GetList
 * - Returns AppUser[]
 */
export const getAllUsers = async (): Promise<AppUser[]> => {
  try {
    const raw = await apiFetch("/api/UserManagement/User/GetList", {
      method: "POST", // backend sometimes uses POST for GetList
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}), // optional filters
    });

    const arr = normalizeArrayResponse(raw);
    return arr.map(mapBackendUser);
  } catch (err: any) {
    throw Object.assign(new Error(err?.message ?? "Failed to fetch users"), {
      status: err?.status,
      body: err?.body,
    });
  }
};

/**
 * getAllUsersIncludingDeleted
 * - If backend has separate endpoint to include deleted, use it.
 * - Here we reuse GetList with includeDeleted flag.
 */
export const getAllUsersIncludingDeleted = async (): Promise<AppUser[]> => {
  try {
    const raw = await apiFetch("/api/UserManagement/User/GetList", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ includeDeleted: true }),
    });

    const arr = normalizeArrayResponse(raw);
    return arr.map(mapBackendUser);
  } catch (err: any) {
    throw Object.assign(new Error(err?.message ?? "Failed to fetch users (including deleted)"), {
      status: err?.status,
      body: err?.body,
    });
  }
};

/**
 * getUserById
 * - GET /api/UserManagement/User/GetModel/{ID}
 */
export const getUserById = async (id: string): Promise<AppUser | null> => {
  if (!id) return null;
  try {
    const raw = await apiFetch(`/api/UserManagement/User/GetModel/${encodeURIComponent(id)}`, {
      method: "GET",
    });
    if (!raw) return null;
    // backend may return { user: {...} } or user object directly
    const actual = raw.user ?? raw.currentUser ?? raw;
    return actual ? mapBackendUser(actual) : null;
  } catch (err: any) {
    if (err?.status === 404) return null;
    throw Object.assign(new Error(err?.message ?? "Failed to fetch user"), {
      status: err?.status,
      body: err?.body,
    });
  }
};

/**
 * addUser (Insert)
 * - POST /api/UserManagement/User/Insert
 * - body: { FirstName, LastName, EmailID, Password, Address, CountryName, StateName, CityName, Zip }
 * - returns the created user (normalized) or inserted id depending on backend
 */
export const addUser = async (payload: Partial<AppUser> & { password?: string }) => {
  try {
    // Build body per backend expectations (use the friendly keys)
    const body: any = {
      FirstName: payload.firstName ?? "",
      LastName: payload.lastName ?? "",
      EmailID: payload.email ?? "",
      Address: payload.address ?? "",
      // Backend expects CountryName/StateName/CityName strings.
      // If frontend only has ids, send them as-is (server-side upsert helpers tolerate it).
      CountryName: payload.countryId ?? undefined,
      StateName: payload.stateId ?? undefined,
      CityName: payload.cityId ?? undefined,
      Zip: payload.zip ?? undefined,
    };

    if (payload.password) body.Password = payload.password;

    const resp = await apiFetch("/api/UserManagement/User/Insert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    // If backend returns array or wrapper, normalize
    const createdObj = resp?.user ?? resp?.currentUser ?? resp ?? null;

    const insertedId = resp?.InsertedID ?? resp?.insertedId ?? resp?.id ?? resp?._id ?? null;

    if (createdObj && (createdObj.userID || createdObj.id || createdObj._id)) {
      return mapBackendUser(createdObj);
    }

    if (insertedId) {
      // Try fetching created model
      try {
        const created = await getUserById(String(insertedId));
        if (created) return created;
      } catch {
        // ignore and continue
      }
    }

    // Fallback: if resp itself looks like user
    if (createdObj) return mapBackendUser(createdObj);

    throw new Error("Failed to create user: no id or user object returned");
  } catch (err: any) {
    throw Object.assign(new Error(err?.message ?? "Failed to create user"), {
      status: err?.status,
      body: err?.body,
    });
  }
};

/**
 * updateUser
 * - PUT /api/UserManagement/User/Update
 * - If you want to update password, include UpdatePassword: true and Password field
 *
 * NOTE: backend expects payload.UserID (not ID)
 */
export const updateUser = async (user: Partial<AppUser> & { id: string; updatePassword?: boolean; password?: string }) => {
  if (!user || !user.id) throw new Error("User id is required for update");
  try {
    const body: any = {
      UserID: user.id, // backend expects UserID
      FirstName: user.firstName ?? undefined,
      LastName: user.lastName ?? undefined,
      EmailID: user.email ?? undefined,
      Address: user.address ?? undefined,
      CountryName: user.countryId ?? undefined,
      StateName: user.stateId ?? undefined,
      CityName: user.cityId ?? undefined,
      Zip: user.zip ?? undefined,
      UpdatePassword: !!user.updatePassword,
    };

    if (user.updatePassword && user.password) {
      body.Password = user.password;
    }

    const resp = await apiFetch("/api/UserManagement/User/Update", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    // Backend may return updated model or just UpdatedOn
    if (resp?.user) return mapBackendUser(resp.user);
    if (resp?.UpdatedOn || resp?.updatedOn) {
      // fetch fresh model
      const fresh = await getUserById(user.id);
      return fresh;
    }

    // fallback attempt to fetch model
    const fresh = await getUserById(user.id);
    if (fresh) return fresh;

    return null;
  } catch (err: any) {
    throw Object.assign(new Error(err?.message ?? "Failed to update user"), {
      status: err?.status,
      body: err?.body,
    });
  }
};

export const updateUserOnServer = updateUser;

/**
 * deleteUser
 * - DELETE /api/UserManagement/User/Delete/{ID}
 */
export const deleteUser = async (id: string) => {
  if (!id) throw new Error("User id required");
  try {
    await apiFetch(`/api/UserManagement/User/Delete/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  } catch (err: any) {
    throw Object.assign(new Error(err?.message ?? "Failed to delete user"), {
      status: err?.status,
      body: err?.body,
    });
  }
};

/**
 * getUserById (number signature compatibility)
 * - support both string & number ids from UI
 */
export const getUserByIdCompatible = async (id: string | number): Promise<AppUser | null> => {
  if (!id) return null;
  return getUserById(String(id));
};

/**
 * getLookupList
 * - GET /api/UserManagement/User/GetLookupList
 * - returns array of { id: string; name: string }
 */
export const getUserLookupList = async (): Promise<{ id: string; name: string }[]> => {
  try {
    const raw = await apiFetch("/api/UserManagement/User/GetLookupList", {
      method: "GET",
    });
    const arr = normalizeArrayResponse(raw);
    return arr.map((r: any) => ({
      id: String(r.UserID ?? r.userID ?? r._id ?? r.id ?? ""),
      name:
        r.UserName ??
        r.userName ??
        `${r.firstName ?? ""} ${r.lastName ?? ""}`.trim() ??
        r.email ??
        "",
    }));
  } catch (err: any) {
    throw Object.assign(new Error(err?.message ?? "Failed to fetch user lookup list"), {
      status: err?.status,
      body: err?.body,
    });
  }
};

/**
 * checkDuplicateEmail
 * - POST /api/UserManagement/User/CheckDuplicateEmailID
 * - body: { EmailID, ExcludeID? }
 */
export const checkDuplicateEmail = async (email: string, excludeId?: string | null): Promise<boolean> => {
  try {
    const resp = await apiFetch("/api/UserManagement/User/CheckDuplicateEmailID", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ EmailID: String(email), ExcludeID: excludeId ?? null }),
    });

    return resp?.isDuplicate === true || resp?.IsDuplicate === true || resp === true;
  } catch (err: any) {
    throw Object.assign(new Error(err?.message ?? "Failed to check duplicate email"), {
      status: err?.status,
      body: err?.body,
    });
  }
};

/**
 * getCurrentUserFromServer
 * - convenience method to fetch current user model by id (calls GetModel)
 */
export const getCurrentUserFromServer = async (id: string): Promise<AppUser | null> => {
  return getUserById(id);
};

/* default export */
export default {
  getAllUsers,
  getAllUsersIncludingDeleted,
  getUserById,
  getUserByIdCompatible,
  addUser,
  updateUser,
  updateUserOnServer,
  deleteUser,
  getUserLookupList,
  checkDuplicateEmail,
  getCurrentUserFromServer,
};
