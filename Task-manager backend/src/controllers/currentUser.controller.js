// src/controllers/currentUser.controller.js
// Hinglish: yaha HTTP request/response handle honge, logic service me hai.

import {
  getCurrentUserService,
  updateCurrentUserService,
  checkDuplicateEmailService,
} from "../services/currentUser.service.js";

// Optional helper to request role hydration if needed.
// If you exported ensureRoleHydrated from your auth middleware, you can uncomment and call it.
// import { ensureRoleHydrated } from "../middlewares/authMiddleware.js";

const DEBUG = process.env.DEBUG_AUTH === "true" || process.env.NODE_ENV !== "production";
function dlog(...args) {
  if (DEBUG) {
    // eslint-disable-next-line no-console
    console.log("[currentUser.controller]", ...args);
  }
}

// Helper to send error JSON consistently
function sendError(res, err) {
  const status = err?.statusCode || err?.status || 500;
  const message = err?.message || "Internal Server Error";
  const body = err?.body ?? undefined;
  const payload = body ? { message, body } : { message };
  return res.status(status).json(payload);
}

// 1) /GetModel – Return current user detail
export const getCurrentUser = async (req, res, next) => {
  try {
    // ensure req.user exists (authMiddleware should set it)
    if (!req || !req.user || !req.user.id) {
      dlog("getCurrentUser -> missing req.user (unauthenticated)");
      return res.status(401).json({ message: "Unauthorized" });
    }

    // OPTIONAL: If you need role available on req.user for downstream logic,
    // uncomment the following line (ensure ensureRoleHydrated is imported).
    // await ensureRoleHydrated(req);

    const currentUserId = req.user.id; // authMiddleware ne set kiya
    const result = await getCurrentUserService(currentUserId);
    return res.json(result);
  } catch (err) {
    // prefer to send meaningful status/message if service threw them
    if (err && (err.statusCode || err.status)) {
      return sendError(res, err);
    }
    // otherwise pass to global error handler
    next(err);
  }
};

// 2) /Update – Update current user detail
export const updateCurrentUser = async (req, res, next) => {
  try {
    if (!req || !req.user || !req.user.id) {
      dlog("updateCurrentUser -> missing req.user (unauthenticated)");
      return res.status(401).json({ message: "Unauthorized" });
    }

    const currentUserId = req.user.id;

    // Validate incoming payload minimally
    if (!req.body || typeof req.body !== "object") {
      return res.status(400).json({ message: "Invalid request body" });
    }

    // optional: prevent clients from changing protected fields accidentally
    // e.g. ensure UserID in payload is not used to override current user
    if (req.body.UserID && String(req.body.UserID) !== String(currentUserId)) {
      // ignore or reject — here we reject for safety
      return res.status(403).json({ message: "You cannot update another user" });
    }

    const result = await updateCurrentUserService(currentUserId, req.body);

    return res.json({
      message: "User updated successfully",
      user: result,
    });
  } catch (err) {
    if (err && (err.statusCode || err.status)) {
      return sendError(res, err);
    }
    next(err);
  }
};

// 3) /CheckDuplicateEmailID – check duplicate
export const checkDuplicateEmailID = async (req, res, next) => {
  try {
    if (!req || !req.user || !req.user.id) {
      dlog("checkDuplicateEmailID -> missing req.user (unauthenticated)");
      return res.status(401).json({ message: "Unauthorized" });
    }

    const currentUserId = req.user.id;
    const { EmailID } = req.body || {};

    if (!EmailID || typeof EmailID !== "string" || !EmailID.trim()) {
      return res.status(400).json({ message: "EmailID is required" });
    }

    // Service will throw 409 if duplicate; otherwise it returns successfully
    await checkDuplicateEmailService(currentUserId, EmailID.trim());

    // yaha tak aa gaye to duplicate nahi hai
    return res.json({ isDuplicate: false });
  } catch (err) {
    // If service threw 409 for duplicate, forward that
    if (err && (err.statusCode || err.status)) {
      return sendError(res, err);
    }
    next(err);
  }
};
