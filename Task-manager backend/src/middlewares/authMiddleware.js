// src/middlewares/authMiddleware.js
/**
 * Robust auth middleware that accepts:
 *  - Authorization: Bearer <token>
 *  - x-access-token header
 *  - HttpOnly cookie named "session" or "token" or "tm_session" or "tm_token"
 *  - signed cookie (via req.signedCookies) named "session" or "token" or "tm_session" or "tm_token"
 *  - ?token=... query param
 *
 * Verifies JWT using verifyAuthToken(token) and sets:
 *   req.user = {
 *     id: string,
 *     role: "Admin" | "User" | null,
 *     isAdmin: boolean,
 *     raw: decodedTokenPayload
 *   }
 *
 * DEBUG: controlled by DEBUG_AUTH env var (or non-production by default).
 */

import { verifyAuthToken, decodeAuthToken } from "../utils/jwt.js";
import { User } from "../models/User.js";

const DEBUG_AUTH =
  process.env.DEBUG_AUTH === "true" || process.env.NODE_ENV !== "production";

function safeLog(...args) {
  if (DEBUG_AUTH) {
    // eslint-disable-next-line no-console
    console.log("[authMiddleware]", ...args);
  }
}

function maskToken(token = "") {
  if (!token) return "";
  if (token.length <= 12) return "***";
  return `${token.slice(0, 6)}...${token.slice(-4)}`;
}

/** Canonical role normalizer: always return "Admin" | "User" | null */
function normalizeRole(val) {
  if (val == null) return null;
  const s = String(val).trim();
  if (!s) return null;

  const lower = s.toLowerCase();

  if (lower === "admin" || lower === "administrator" || lower === "superadmin") {
    return "Admin";
  }

  if (lower === "user" || lower === "basic" || lower === "normal") {
    return "User";
  }

  // Agar DB me already "Admin"/"User" padha hai, to use hi return kar do
  if (s === "Admin" || s === "User") return s;

  // Unknown role values ko normal user treat kar sakte ho,
  // ya phir null return kar sakte ho. Yaha hum "User" treat kar rahe hain:
  return "User";
}

/**
 * Helper: safe decode for debug only
 */
function safeDecode(t) {
  try {
    return decodeAuthToken ? decodeAuthToken(t) : "[no-decode-fn]";
  } catch (e) {
    return `[decode-failed: ${e?.message || e?.name}]`;
  }
}

/**
 * tryVerify(token) -> { ok: boolean, decoded: any|null, reason: string|null }
 */
async function tryVerify(token) {
  if (!token) return { ok: false, decoded: null, reason: "no-token" };
  try {
    const decoded = await verifyAuthToken(token);
    return { ok: true, decoded, reason: null };
  } catch (err) {
    const reason = err?.message || err?.name || "invalid";
    return { ok: false, decoded: null, reason };
  }
}

/**
 * Public routes that should NOT require authentication.
 * Add any other public endpoints here (exact path or prefix using trailing "*").
 */
const PUBLIC_PATHS = [
  "/api/UserManagement/UserRegistration", // signup
  "/api/UserManagement/Authentication/Login", // login
  "/api/UserManagement/Authentication/Logout",
  "/api/UserManagement/ForgotPassword",
  "/api/UserManagement/ValidateResetPasswordCode",
  "/api/UserManagement/ResetPassword",
  "/api/auth/login",
  "/api/auth/me", // allow /api/auth/me to self-handle 401
  "/auth/login",
  "/auth/me",
  "/health",
  "/healthz",
  "/public", // example static public prefix
];

/**
 * Check whether request path is public.
 * Supports exact match and prefix match when an entry ends with "*" or ends with "/"
 */
function isPublicPath(req) {
  const p = req.path || req.url || "";
  // OPTIONS preflight should be allowed
  if ((req.method || "").toUpperCase() === "OPTIONS") return true;

  for (const pattern of PUBLIC_PATHS) {
    if (!pattern) continue;
    if (pattern.endsWith("*")) {
      const prefix = pattern.slice(0, -1);
      if (p.startsWith(prefix)) return true;
    } else if (pattern.endsWith("/")) {
      if (p.startsWith(pattern)) return true;
    } else {
      if (p === pattern) return true;
    }
  }
  return false;
}

/**
 * Extract role from decoded token claims if present
 * ALWAYS return canonical: "Admin" | "User" | null
 */
function extractRoleFromDecoded(decoded) {
  if (!decoded) return null;

  const roleCandidates = [
    decoded.role,
    decoded.roles,
    decoded.roleName,
    decoded.userRole,
    decoded.user_type,
    decoded.userType,
    decoded.isAdmin ? "admin" : null,
  ];

  for (const c of roleCandidates) {
    if (!c) continue;

    if (typeof c === "string") {
      const r = normalizeRole(c);
      if (r) return r;
    }

    if (Array.isArray(c) && c.length) {
      // Arrays ko bhi handle karo (e.g. ["User", "Admin"])
      const normalized = c
        .map((x) => normalizeRole(x))
        .filter(Boolean);

      if (normalized.includes("Admin")) return "Admin";
      if (normalized.includes("User")) return "User";
      if (normalized.length) return normalized[0];
    }
  }

  return null;
}

/**
 * Helper: hydrate role from DB if token doesn't contain role
 * Returns canonical "Admin" | "User" | null
 */
async function hydrateRoleFromDb(userId) {
  if (!userId) return null;
  try {
    const dbUser = await User.findById(userId)
      .select("role roles isAdmin roleName")
      .lean();

    if (!dbUser) return null;

    // Try typical fields first
    if (dbUser.isAdmin === true) {
      return "Admin";
    }

    if (dbUser.role) {
      return normalizeRole(dbUser.role);
    }

    if (Array.isArray(dbUser.roles) && dbUser.roles.length) {
      const fromRoles = dbUser.roles
        .map((x) => normalizeRole(x))
        .filter(Boolean);
      if (fromRoles.includes("Admin")) return "Admin";
      if (fromRoles.includes("User")) return "User";
      if (fromRoles.length) return fromRoles[0];
    }

    if (dbUser.roleName) {
      return normalizeRole(dbUser.roleName);
    }

    return null;
  } catch (e) {
    safeLog(
      "failed to hydrate role from DB for user",
      userId,
      e?.message || e
    );
    return null;
  }
}

/**
 * Main middleware
 */
export const authMiddleware = async (req, res, next) => {
  try {
    // If this path is explicitly public, skip authentication
    if (isPublicPath(req)) {
      safeLog("public path hit, skipping auth:", req.path);
      return next();
    }

    // Collect token candidates
    const headerRaw = (req.headers.authorization || "").trim();
    const headerToken =
      headerRaw && headerRaw.toLowerCase().startsWith("bearer ")
        ? headerRaw.split(/\s+/)[1]
        : null;

    const xAccessRaw = req.headers["x-access-token"] ?? null;
    const xAccessToken = Array.isArray(xAccessRaw)
      ? String(xAccessRaw[0])
      : xAccessRaw
      ? String(xAccessRaw)
      : null;

    // support common cookie names (normal + signed)
    const cookieNames = ["session", "token", "tm_session", "tm_token"];
    let cookieToken = null;
    let signedCookieToken = null;

    if (req.cookies) {
      for (const n of cookieNames) {
        if (!cookieToken && req.cookies[n]) cookieToken = req.cookies[n];
      }
    }
    if (req.signedCookies) {
      for (const n of cookieNames) {
        if (!signedCookieToken && req.signedCookies[n]) {
          signedCookieToken = req.signedCookies[n];
        }
      }
    }

    const queryToken =
      req.query && req.query.token ? String(req.query.token) : null;

    safeLog("candidates present:", {
      cookie: !!cookieToken,
      signedCookie: !!signedCookieToken,
      header: !!headerToken,
      xAccess: !!xAccessToken,
      query: !!queryToken,
    });

    if (DEBUG_AUTH) {
      if (cookieToken)
        safeLog(
          "cookie token:",
          maskToken(cookieToken),
          "decoded:",
          safeDecode(cookieToken)
        );
      if (signedCookieToken)
        safeLog(
          "signed cookie token:",
          maskToken(signedCookieToken),
          "decoded:",
          safeDecode(signedCookieToken)
        );
      if (headerToken)
        safeLog(
          "authorization header token:",
          maskToken(headerToken),
          "decoded:",
          safeDecode(headerToken)
        );
      if (xAccessToken && !headerToken)
        safeLog(
          "x-access-token:",
          maskToken(xAccessToken),
          "decoded:",
          safeDecode(xAccessToken)
        );
      if (
        queryToken &&
        !cookieToken &&
        !signedCookieToken &&
        !headerToken &&
        !xAccessToken
      )
        safeLog(
          "query token:",
          maskToken(queryToken),
          "decoded:",
          safeDecode(queryToken)
        );
    }

    // Preferred order: signed cookie -> cookie -> header/x-access-token -> query
    const orderedCandidates = [
      signedCookieToken,
      cookieToken,
      headerToken || xAccessToken,
      queryToken,
    ].filter(Boolean);

    for (const candidate of orderedCandidates) {
      const { ok, decoded, reason } = await tryVerify(candidate);
      if (!ok) {
        safeLog(
          "token verification failed for candidate",
          maskToken(candidate),
          "reason:",
          reason
        );
        continue;
      }

      // Extract user id from token claims
      const userId =
        decoded?.sub ??
        decoded?.userId ??
        decoded?.id ??
        decoded?.userID ??
        (typeof decoded === "string" ? decoded : null);

      if (!userId) {
        safeLog(
          "verified token but no user id claim found in payload:",
          decoded
        );
        continue;
      }

      const userIdStr = String(userId);
      safeLog("auth success, userId=", userIdStr);

      // Base user object
      const baseUser = { id: userIdStr, raw: decoded };

      // Try to get role from token claims (canonical "Admin"/"User"/null)
      let role = extractRoleFromDecoded(decoded);
      if (role) {
        baseUser.role = role;
        baseUser.isAdmin = role === "Admin";
        safeLog("role taken from token claims:", role);
      } else {
        // Fallback: hydrate role from DB
        const dbRole = await hydrateRoleFromDb(userIdStr);
        if (dbRole) {
          baseUser.role = dbRole;
          baseUser.isAdmin = dbRole === "Admin";
          safeLog("role hydrated from DB:", dbRole);
        } else {
          safeLog("no role found in token or DB for user", userIdStr);
          baseUser.role = null;
          baseUser.isAdmin = false;
        }
      }

      // Attach to request and proceed
      req.user = baseUser;
      return next();
    }

    // No candidate verified
    safeLog("no valid token found - returning 401 present:", {
      cookie: !!cookieToken,
      signedCookie: !!signedCookieToken,
      header: !!headerToken,
      xAccess: !!xAccessToken,
      query: !!queryToken,
    });
    return res.status(401).json({ message: "Unauthorized" });
  } catch (err) {
    // Unexpected errors -> log and return 401
    // eslint-disable-next-line no-console
    console.error("[authMiddleware] unexpected error:", err);
    return res.status(401).json({ message: "Unauthorized" });
  }
};

/**
 * Optional helper if you ever want to call it manually in controllers.
 * With the updated middleware above, normally you won't need this.
 */
export async function ensureRoleHydrated(req) {
  try {
    if (!req.user) return;
    if (req.user.role) return;
    const dbRole = await hydrateRoleFromDb(req.user.id);
    if (dbRole) {
      req.user.role = dbRole;
      req.user.isAdmin = dbRole === "Admin";
      safeLog("ensureRoleHydrated set role to:", dbRole);
    }
  } catch (e) {
    safeLog("ensureRoleHydrated unexpected error:", e);
  }
}

export default authMiddleware;
