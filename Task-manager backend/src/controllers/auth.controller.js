// src/controllers/auth.controller.js
import {
  loginService,
  sendResetPasswordCodeService,
  validateResetPasswordCodeService,
  resetPasswordService,
  getCurrentUserService,
  logoutService,
  // signupService may or may not exist in your services file — controller will prefer it if present
  // if you export signupService from services, this import will be used by the controller logic
  // otherwise the controller falls back to direct model usage below.
  signupService,
} from "../services/auth.service.js";

import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { User } from "../models/User.js";

const COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "session";
const JWT_SECRET = process.env.JWT_SECRET || "super_secret_jwt_key_change_me";
const DEBUG_AUTH =
  process.env.DEBUG_AUTH === "true" || process.env.NODE_ENV !== "production";

const DEFAULT_SALT_ROUNDS = parseInt(process.env.SALT_ROUNDS || "10", 10);

/* helper to sign token */
function signToken(payload, expiresIn = "1d") {
  const tokenPayload = {
    sub: payload.sub,
    role: payload.role,
    firstName: payload.firstName,
    lastName: payload.lastName,
    email: payload.email,
  };
  return jwt.sign(tokenPayload, JWT_SECRET, { expiresIn });
}

/* cookie helpers */
function setAuthCookie(res, token, remember = false) {
  const opts = {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };

  opts.maxAge = remember
    ? 30 * 24 * 60 * 60 * 1000
    : 24 * 60 * 60 * 1000;

  res.cookie(COOKIE_NAME, token, opts);

  if (DEBUG_AUTH) {
    try {
      const decoded = jwt.decode(token);
      console.log(
        "Auth controller: setAuthCookie -> token len:",
        token?.length ?? 0,
        "decoded:",
        decoded
      );
    } catch (e) {
      console.log(
        "Auth controller: setAuthCookie -> token len:",
        token?.length ?? 0,
        "(decode failed)"
      );
    }
  }
}

function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  if (DEBUG_AUTH) console.log("Auth controller: cleared auth cookie");
}

/* -------------------------- HELPERS -------------------------- */

/**
 * Normalize zipCodes input: accept string or array and always return array of strings
 * @param {string|string[]|undefined} raw
 * @returns {string[]}
 */
function normalizeZipCodes(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map((z) => String(z).trim()).filter(Boolean);
  }
  if (typeof raw === "string") {
    return raw
      .split(",")
      .map((z) => String(z).trim())
      .filter(Boolean);
  }
  return [];
}

/* -------------------------- SIGNUP -------------------------- */
export const signup = async (req, res, next) => {
  try {
    const body = req.body || {};

    // accept either email or EmailID from various frontends
    const emailRaw = body.email ?? body.EmailID ?? "";
    const password = body.password ?? body.Password ?? "";

    if (!emailRaw || !password) {
      res.status(400);
      throw new Error("Email and password are required");
    }

    const email = String(emailRaw).trim().toLowerCase();

    // basic password length check (adjust as needed)
    if (String(password).length < 6) {
      res.status(400);
      throw new Error("Password must be at least 6 characters long");
    }

    // validate email format (basic)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400);
      throw new Error("Invalid email address");
    }

    // If a signupService exists, prefer that (it may implement extra rules)
    if (typeof signupService === "function") {
      try {
        const result = await signupService(body);
        return res.status(201).json({ success: true, data: result });
      } catch (errFromService) {
        if (DEBUG_AUTH) console.warn("Auth controller: signupService error:", errFromService);
        const status = errFromService.statusCode || (errFromService.code === 11000 ? 409 : 500);
        return res.status(status).json({ success: false, message: errFromService.message || "Signup failed" });
      }
    }

    // Fallback: direct Mongoose create here
    // check duplicate email
    const existing = await User.findOne({
      $or: [{ email }, { emailID: email }],
    }).lean();

    if (existing) {
      return res.status(409).json({ success: false, message: "Email already in use" });
    }

    // hash password
    const saltRounds = parseInt(process.env.SALT_ROUNDS || `${DEFAULT_SALT_ROUNDS}`, 10);
    const hashed = await bcrypt.hash(String(password), saltRounds);

    // normalize zipCodes
    // Use nullish coalescing only to avoid operator mixing issues
    const zipField = body.zipCodes ?? body.zipCode ?? body.zip ?? "";
    const zipCodes = normalizeZipCodes(zipField);

    const userDoc = {
      firstName: body.firstName ? String(body.firstName).trim() : "",
      lastName: body.lastName ? String(body.lastName).trim() : "",
      email,
      emailID: email,
      password: hashed,
      role: body.role ? String(body.role) : "User",
      phone: body.phone ? String(body.phone).trim() : "",
      avatarUrl: body.avatarUrl ? String(body.avatarUrl).trim() : "",
      cityId: body.cityId || body.cityID || body.city || null,
      stateId: body.stateId || body.stateID || null,
      countryId: body.countryId || body.countryID || null,
      zipCodes,
      isDeleted: false,
      isActive: true,
      createdOn: new Date(),
      updatedOn: new Date(),
      createdBy: body.createdBy || null,
    };

    const created = await User.create(userDoc);

    const out = created.toObject ? created.toObject() : created;
    if (out.password) delete out.password;

    return res.status(201).json({ success: true, data: out });
  } catch (err) {
    if (err && (err.code === 11000 || (err.message && err.message.includes("duplicate")))) {
      return res.status(409).json({ success: false, message: "Duplicate key error" });
    }
    next(err);
  }
};

/* -------------------------- LOGIN -------------------------- */
export const login = async (req, res, next) => {
  try {
    const body = req.body || {};

    if (DEBUG_AUTH) {
      console.log("Auth controller: login - body keys:", Object.keys(body));
      console.log("Auth controller: login - fields present:", {
        EmailID: !!body?.EmailID,
        email: !!body?.email,
        Password: !!body?.Password,
        password: !!body?.password,
        remember: !!body?.remember,
        rememberMe: !!body?.rememberMe,
      });
    }

    const EmailID = body.EmailID ?? body.email;
    const Password = body.Password ?? body.password;
    const remember = !!(body.remember || body.rememberMe);

    if (!EmailID || !Password) {
      res.status(400);
      throw new Error("EmailID and Password are required");
    }

    const result = await loginService(EmailID, Password);
    if (!result) {
      if (DEBUG_AUTH) console.log("Auth controller: loginService returned falsy -> invalid credentials");
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const userFromService = result?.user ?? result?.currentUser ?? result?.userData ?? null;

    const returnedToken =
      typeof result === "string"
        ? result
        : result?.authToken ?? result?.token ?? result?.accessToken ?? null;

    let dbUser = null;
    try {
      const candidateId =
        userFromService && (userFromService.id ?? userFromService._id ?? userFromService.userID);

      if (candidateId) {
        dbUser = await User.findById(candidateId).select("role firstName lastName emailID email").lean();
      }

      if (!dbUser) {
        const svcEmail = userFromService && (userFromService.email ?? userFromService.emailID);
        dbUser = await User.findOne({
          $or: [{ emailID: EmailID }, { email: EmailID }, ...(svcEmail ? [{ email: svcEmail }, { emailID: svcEmail }] : [])],
        })
          .select("role firstName lastName emailID email")
          .lean();
      }
    } catch (e) {
      if (DEBUG_AUTH) console.warn("Auth controller: DB lookup for user failed:", e?.message ?? e);
    }

    const finalUser = dbUser
      ? dbUser
      : userFromService
      ? {
          role: userFromService.role ?? null,
          firstName: userFromService.firstName ?? userFromService.first_name ?? "",
          lastName: userFromService.lastName ?? userFromService.last_name ?? "",
          email: userFromService.email ?? userFromService.emailID ?? EmailID,
          emailID: userFromService.emailID ?? userFromService.email ?? EmailID,
          id: userFromService.id ?? userFromService._id ?? userFromService.userID ?? null,
        }
      : null;

    const userId =
      (finalUser && (finalUser._id ?? finalUser.id)) ? String(finalUser._id ?? finalUser.id)
        : userFromService && (userFromService.id ?? userFromService._id)
        ? String(userFromService.id ?? userFromService._id)
        : null;

    const roleFromDb = finalUser && finalUser.role ? String(finalUser.role) : null;
    const roleFromService = userFromService && userFromService.role ? String(userFromService.role) : null;

    const normalizedRole = roleFromDb || roleFromService || "User";

    const payload = {
      sub: userId ?? null,
      role: normalizedRole,
      firstName: (finalUser && (finalUser.firstName ?? finalUser.first_name)) || "",
      lastName: (finalUser && (finalUser.lastName ?? finalUser.last_name)) || "",
      email: (finalUser && (finalUser.email ?? finalUser.emailID)) || EmailID,
    };

    const tokenExpiry = remember ? "30d" : "1d";
    let tokenToSet = null;
    if (payload.sub) {
      try {
        tokenToSet = signToken(payload, tokenExpiry);
      } catch (e) {
        if (DEBUG_AUTH) console.warn("Auth controller: signToken failed:", e?.message ?? e);
        tokenToSet = returnedToken ?? null;
      }
    } else {
      tokenToSet = returnedToken ?? signToken(payload, tokenExpiry);
    }

    if (tokenToSet) setAuthCookie(res, tokenToSet, remember);

    if (DEBUG_AUTH) {
      console.log("Auth controller: login successful - tokenPresent:", !!tokenToSet, "dbUserPresent:", !!dbUser, "finalRole:", normalizedRole);
    }

    const outUser = {
      id: userId ?? (userFromService ? String(userFromService.id ?? userFromService._id ?? "") : ""),
      firstName: payload.firstName,
      lastName: payload.lastName,
      email: payload.email,
      role: normalizedRole,
    };

    return res.json({
      message: "Login successful",
      user: outUser,
      authToken: tokenToSet ?? undefined,
    });
  } catch (err) {
    next(err);
  }
};

/* -------------------------- GET CURRENT USER (/api/auth/me) -------------------------- */
export const getCurrentUser = async (req, res, next) => {
  if (DEBUG_AUTH) {
    console.log(">>> /api/auth/me - req.headers.cookie:", req.headers.cookie);
    console.log(">>> /api/auth/me - req.cookies:", req.cookies);
    console.log(">>> /api/auth/me - Authorization:", req.headers.authorization);
  }

  try {
    const tokenFromCookie = req.cookies?.[COOKIE_NAME];
    const authHeader = req.headers?.authorization;
    const bearer = authHeader && String(authHeader).startsWith("Bearer ") ? authHeader.slice(7) : null;

    const token = tokenFromCookie || bearer || (req.query && req.query.token ? String(req.query.token) : null);

    if (DEBUG_AUTH) {
      console.log("Auth controller: getCurrentUser -> tokenFromCookiePresent:", !!tokenFromCookie, "bearerPresent:", !!bearer);
      if (tokenFromCookie) {
        try {
          console.log("Auth controller: getCurrentUser -> cookie token len:", tokenFromCookie.length, "decoded:", jwt.decode(tokenFromCookie));
        } catch (e) {
          console.log("Auth controller: getCurrentUser -> cookie token decode failed");
        }
      }
    }

    try {
      if (typeof getCurrentUserService === "function") {
        const data = await getCurrentUserService(token, req);
        if (data) {
          if (DEBUG_AUTH) console.log("Auth controller: getCurrentUser -> getCurrentUserService returned data");
          return res.json(data);
        }
      }
    } catch (e) {
      if (DEBUG_AUTH) console.warn("Auth controller: getCurrentUserService error (ignored):", e?.message ?? e);
    }

    if (token && JWT_SECRET) {
      try {
        const payload = jwt.verify(token, JWT_SECRET);
        const normalized = {
          id: payload.sub ?? payload.id ?? payload.userId ?? null,
          firstName: payload.firstName ?? payload.first_name ?? "",
          lastName: payload.lastName ?? payload.last_name ?? "",
          email: payload.email ?? "",
          role: payload.role ?? "User",
        };
        if (DEBUG_AUTH) console.log("Auth controller: getCurrentUser -> JWT fallback decoded sub:", payload?.sub ?? payload);
        if (normalized.id) return res.json(normalized);
      } catch (err) {
        if (DEBUG_AUTH) console.warn("Auth controller: JWT verify failed in getCurrentUser:", err?.message ?? err);
      }
    }

    return res.status(401).json({ message: "Not authenticated" });
  } catch (err) {
    next(err);
  }
};

/* -------------------------- LOGOUT -------------------------- */
export const logout = async (req, res, next) => {
  try {
    const token =
      req.cookies?.[COOKIE_NAME] ||
      (req.headers?.authorization && String(req.headers?.authorization).startsWith("Bearer ") ? String(req.headers.authorization).slice(7) : null);

    if (DEBUG_AUTH) {
      console.log("Auth controller: logout called - tokenPresent:", !!token);
    }

    try {
      if (typeof logoutService === "function") {
        await logoutService(token, req);
      }
    } catch (e) {
      if (DEBUG_AUTH) console.warn("Auth controller: logoutService error (ignored):", e?.message ?? e);
    }

    clearAuthCookie(res);
    return res.json({ ok: true, message: "Logged out" });
  } catch (err) {
    next(err);
  }
};

/* -------------------------- PASSWORD RESET -------------------------- */
export const sendResetPasswordCode = async (req, res, next) => {
  try {
    const { EmailID, resetPageBaseUrl } = req.body || {};
    if (!EmailID) {
      res.status(400);
      throw new Error("EmailID is required");
    }
    if (!resetPageBaseUrl) {
      res.status(400);
      throw new Error("resetPageBaseUrl is required");
    }

    const result = await sendResetPasswordCodeService(EmailID, resetPageBaseUrl);
    if (!result?.success) return res.status(404).json({ message: "User not found" });

    return res.json({
      message: "Reset password mail sent",
      resetPasswordCode: result.code,
    });
  } catch (err) {
    next(err);
  }
};

export const validateResetPasswordCode = async (req, res, next) => {
  try {
    const { ResetPasswordCode } = req.body || {};
    const result = await validateResetPasswordCodeService(ResetPasswordCode);
    if (result.status === "invalid") return res.status(400).json({ message: "Invalid Code." });
    if (result.status === "expired") return res.status(400).json({ message: "Code is expired." });
    return res.json({ message: "Ok" });
  } catch (err) {
    next(err);
  }
};

export const resetPassword = async (req, res, next) => {
  try {
    const { ResetPasswordCode, Password } = req.body || {};
    const result = await resetPasswordService(ResetPasswordCode, Password);
    if (result.status === "invalid") return res.status(400).json({ message: "Invalid Code." });
    if (result.status === "expired") return res.status(400).json({ message: "Code is expired." });
    return res.json({
      message: "Password reset successful",
    });
  } catch (err) {
    next(err);
  }
};

export default {
  signup,
  login,
  getCurrentUser,
  logout,
  sendResetPasswordCode,
  validateResetPasswordCode,
  resetPassword,
};
