// src/controllers/userManagement.controller.js
// Hinglish: User list / user management ke HTTP handlers
// Controllers sirf request/response handle karenge — business logic services me rakha hai.

import {
  getUserListService,
  getUserModelService,
  getUserLookupListService,
  insertUserService,
  updateUserService,
  deleteUserService,
  checkDuplicateEmailForUserService,
} from "../services/userManagement.service.js";

/**
 * Helper: safe parse id-like values (null if missing/empty)
 */
function asMaybeId(val) {
  if (val === undefined || val === null) return null;
  const s = String(val).trim();
  return s === "" ? null : s;
}

/**
 * Safe helper to extract current user info object for services.
 * Yahi se req.user ko service tak forward kar rahe hain.
 */
function getCurrentUserFromReq(req) {
  if (!req || !req.user) return null;
  return req.user;
}

/**
 * Helper: unified response for errors (optional)
 */
function handleError(err, next) {
  // Central error handler hi final JSON banayega
  return next(err);
}

/**
 * 1) GET/POST /UserManagement/User/GetList
 *
 *    Optional query/body param: id
 *    Returns: array
 *
 *    IMPORTANT (business rule):
 *      - Admin  => sab users (filter sirf optional id se)
 *      - User   => sirf khud ke banaye hue users (createdBy = currentUser.id)
 *    Ye logic service ke andar implement hai.
 */
export const getUserList = async (req, res, next) => {
  try {
    const id = asMaybeId(req.query?.id ?? req.body?.id);
    const currentUser = getCurrentUserFromReq(req);

    // Debug info (optional)
    // eslint-disable-next-line no-console
    console.debug(
      "[getUserList] requested by:",
      currentUser ? { id: currentUser.id, role: currentUser.role } : "anonymous"
    );

    const result = await getUserListService(id, currentUser);

    // Debug: result summary
    try {
      console.debug(
        "[getUserList] returning count:",
        Array.isArray(result) ? result.length : "non-array",
        "sample:",
        Array.isArray(result) && result.length ? result[0] : null
      );
    } catch (e) {
      console.debug("[getUserList] debug log failed:", e?.message ?? e);
    }

    return res.status(200).json(result);
  } catch (err) {
    return handleError(err, next);
  }
};

/**
 * 2) GET /UserManagement/User/GetModel/:id
 *    (GET with query ?id= bhi accept kar sakte ho)
 *
 *    Service ke andar:
 *      - Admin  => kisi ka bhi model dekh sakta
 *      - User   => sirf khud ka ya jo usne create kiya ho
 */
export const getUserModel = async (req, res, next) => {
  try {
    const id = asMaybeId(req.params?.id ?? req.query?.id);
    if (!id) {
      const e = new Error("User id is required.");
      e.statusCode = 400;
      throw e;
    }

    const currentUser = getCurrentUserFromReq(req);
    const result = await getUserModelService(id, currentUser);

    if (!result) {
      const e = new Error("User not found.");
      e.statusCode = 404;
      throw e;
    }

    return res.status(200).json(result);
  } catch (err) {
    return handleError(err, next);
  }
};

/**
 * 3) GET/POST /UserManagement/User/GetLookupList
 *    Lightweight lookup for dropdowns.
 *
 *    Service logic:
 *      - Admin  => sab active users
 *      - User   => khud + jo usne create kiye
 */
export const getUserLookupList = async (req, res, next) => {
  try {
    const currentUser = getCurrentUserFromReq(req);

    const result =
      typeof getUserLookupListService === "function"
        ? await getUserLookupListService(currentUser)
        : await getUserLookupListService();

    return res.status(200).json(result);
  } catch (err) {
    return handleError(err, next);
  }
};

/**
 * 4) POST /UserManagement/User/Insert
 *    Naya user create karta hai.
 *    createdBy ke liye currentUserId pass kar rahe hain.
 *
 *    Service ke andar:
 *      - role default "User" (User model me default)
 */
export const insertUser = async (req, res, next) => {
  try {
    const currentUser = getCurrentUserFromReq(req);
    const currentUserId = currentUser?.id ?? null;
    const payload = req.body || {};

    // Basic defensive validation (service me bhi detailed validation hai)
    if (!payload?.EmailID || !payload?.FirstName || !payload?.LastName) {
      const e = new Error("FirstName, LastName and EmailID are required.");
      e.statusCode = 400;
      throw e;
    }

    const result = await insertUserService(payload, currentUserId);
    return res.status(201).json(result);
  } catch (err) {
    return handleError(err, next);
  }
};

/**
 * 5) PUT /UserManagement/User/Update
 *    Body: user payload including UserID
 *
 *    Service ke andar:
 *      - Admin  => kisi ka bhi update
 *      - User   => sirf khud ka / apne banaye hue (business rule ke hisaab se)
 */
export const updateUser = async (req, res, next) => {
  try {
    const currentUser = getCurrentUserFromReq(req);
    const currentUserId = currentUser?.id ?? null;
    const payload = req.body || {};

    if (!payload) {
      const e = new Error("Request body is required.");
      e.statusCode = 400;
      throw e;
    }

    const result = await updateUserService(payload, currentUserId);
    return res.status(200).json(result);
  } catch (err) {
    return handleError(err, next);
  }
};

/**
 * 6) DELETE /UserManagement/User/Delete/:id
 *
 *    Service ke andar:
 *      - agar user ke assigned tasks hain -> error
 *      - warna permanent delete
 */
export const deleteUser = async (req, res, next) => {
  try {
    const currentUser = getCurrentUserFromReq(req);
    const currentUserId = currentUser?.id ?? null;
    const id = asMaybeId(req.params?.id);

    if (!id) {
      const e = new Error("User id is required for delete.");
      e.statusCode = 400;
      throw e;
    }

    const result = await deleteUserService(id, currentUserId);
    return res.status(200).json(result ?? { message: "Deleted" });
  } catch (err) {
    return handleError(err, next);
  }
};

/**
 * 7) POST /UserManagement/User/CheckDuplicateEmailID
 *    Body: { EmailID, ExcludeID? } -> returns { isDuplicate: boolean }
 */
export const checkDuplicateEmailIDForUser = async (req, res, next) => {
  try {
    const { EmailID, ExcludeID } = req.body || {};

    if (!EmailID || !String(EmailID).trim()) {
      const e = new Error("EmailID is required.");
      e.statusCode = 400;
      throw e;
    }

    const result = await checkDuplicateEmailForUserService(
      String(EmailID).trim(),
      ExcludeID ?? null
    );

    if (typeof result === "boolean") {
      return res.status(200).json({ isDuplicate: result });
    }
    return res.status(200).json(result);
  } catch (err) {
    return handleError(err, next);
  }
};
