// src/services/auth.service.js
// Business logic for authentication: login, reset password flows, signup, and small helpers

import { User } from "../models/User.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import { generateAuthToken, verifyAuthToken } from "../utils/jwt.js";
import { v4 as uuidv4 } from "uuid";
import { sendResetPasswordEmail } from "./email.service.js";

const RESET_MIN = Number(process.env.RESET_PASSWORD_EXP_MINUTES || 10);
const DEFAULT_SALT_ROUNDS = parseInt(process.env.SALT_ROUNDS || "10", 10);

/* -------------------------
   HELPERS
------------------------- */

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

/* -------------------------
   SIGNUP SERVICE
------------------------- */
/**
 * signupService(payload)
 * payload should include: email/emailID, password, firstName?, lastName?, role?, phone?, avatarUrl?,
 * cityId?, stateId?, countryId?, zipCodes?
 *
 * Returns created user object (without password) or throws error (with statusCode if desired).
 */
export const signupService = async (payload = {}) => {
  const emailRaw = payload.email ?? payload.EmailID ?? payload.emailID ?? "";
  const passwordRaw = payload.password ?? payload.Password ?? "";

  if (!emailRaw || !passwordRaw) {
    const err = new Error("Email and password are required");
    err.statusCode = 400;
    throw err;
  }

  const email = String(emailRaw).trim().toLowerCase();
  const password = String(passwordRaw);

  // basic password length check
  if (password.length < 6) {
    const err = new Error("Password must be at least 6 characters long");
    err.statusCode = 400;
    throw err;
  }

  // basic email format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    const err = new Error("Invalid email address");
    err.statusCode = 400;
    throw err;
  }

  // check duplicate email (emailID and email fields)
  const existing = await User.findOne({
    $or: [{ emailID: email }, { email: email }],
  }).lean();

  if (existing) {
    const err = new Error("Email already in use");
    err.statusCode = 409;
    throw err;
  }

  // hash password
  const hashed = await hashPassword(password, DEFAULT_SALT_ROUNDS);

  // normalize zipCodes
  const zipCodes = normalizeZipCodes(payload.zipCodes ?? payload.zipCode ?? payload.zip ?? "");

  const userDoc = {
    firstName: payload.firstName ? String(payload.firstName).trim() : "",
    lastName: payload.lastName ? String(payload.lastName).trim() : "",
    email: email,
    emailID: email,
    password: hashed,
    role: payload.role ? String(payload.role) : "user",
    phone: payload.phone ? String(payload.phone).trim() : "",
    avatarUrl: payload.avatarUrl ? String(payload.avatarUrl).trim() : "",
    cityId: payload.cityId || payload.cityID || null,
    stateId: payload.stateId || payload.stateID || null,
    countryId: payload.countryId || payload.countryID || null,
    zipCodes,
    isDeleted: false,
    isActive: true,
    createdOn: new Date(),
    updatedOn: new Date(),
    createdBy: payload.createdBy || null,
  };

  // create user
  const created = await User.create(userDoc);

  // remove sensitive fields before returning
  const out = created.toObject ? created.toObject() : created;
  if (out.password) delete out.password;
  return out;
};

/* -------------------------
   LOGIN
------------------------- */
export const loginService = async (emailID, password) => {
  // find user by emailID (your DB field)
  const user = await User.findOne({ emailID });

  if (!user) {
    // user not found
    return null;
  }

  // Validate password (supports bcrypt hash or legacy plaintext)
  let isValid = false;
  if (user.password && typeof user.password === "string" && user.password.startsWith("$2")) {
    isValid = await verifyPassword(password, user.password);
  } else {
    isValid = password === user.password;
  }

  if (!isValid) return null;

  // Generate token (using util) — include sub claim for consistency
  const token = generateAuthToken(String(user._id ?? user.id));

  // Normalized user for controller consumption
  const normalizedUser = {
    id: String(user._id ?? user.id),
    firstName: user.firstName ?? "",
    lastName: user.lastName ?? "",
    email: user.emailID ?? user.email ?? "",
    avatarUrl: user.avatarUrl ?? null,
    role: user.role ?? "user",
  };

  return { authToken: token, user: normalizedUser };
};

/* -------------------------
   SEND RESET PASSWORD CODE
------------------------- */
export const sendResetPasswordCodeService = async (emailID, resetPageBaseUrl) => {
  const user = await User.findOne({ emailID });
  if (!user) {
    return { success: false };
  }

  const code = uuidv4();
  const validUpto = new Date(Date.now() + RESET_MIN * 60 * 1000);

  user.resetPasswordCode = code;
  user.resetPasswordCodeValidUpto = validUpto;
  await user.save();

  const resetLink = `${resetPageBaseUrl.replace(/\/$/, "")}/${code}`;
  try {
    await sendResetPasswordEmail(user.emailID, resetLink);
  } catch (e) {
    console.warn("sendResetPasswordCodeService: email send failed", e);
  }

  return { success: true, code };
};

/* -------------------------
   VALIDATE RESET PASSWORD CODE
------------------------- */
export const validateResetPasswordCodeService = async (code) => {
  if (!code) return { status: "invalid", message: "Invalid Code." };

  const user = await User.findOne({ resetPasswordCode: code });
  if (!user) return { status: "invalid", message: "Invalid Code." };

  if (!user.resetPasswordCodeValidUpto || user.resetPasswordCodeValidUpto < new Date()) {
    return { status: "expired", message: "Code is expired." };
  }

  return { status: "ok" };
};

/* -------------------------
   RESET PASSWORD
------------------------- */
export const resetPasswordService = async (code, newPassword) => {
  if (!code) return { status: "invalid", message: "Invalid Code." };

  const user = await User.findOne({ resetPasswordCode: code });
  if (!user) return { status: "invalid", message: "Invalid Code." };

  if (!user.resetPasswordCodeValidUpto || user.resetPasswordCodeValidUpto < new Date()) {
    return { status: "expired", message: "Code is expired." };
  }

  user.password = await hashPassword(newPassword);
  user.resetPasswordCode = null;
  user.resetPasswordCodeValidUpto = null;
  await user.save();

  return { status: "ok" };
};

/* -------------------------
   GET CURRENT USER SERVICE (token-based)
   - Accepts token (from cookie, Authorization header, query or direct param)
   - Verifies JWT via verifyAuthToken and returns normalized user object or null
------------------------- */
export const getCurrentUserService = async (token /* string */, req /* optional */) => {
  try {
    // Resolve token from multiple sources (priority: explicit param -> Authorization header -> cookie -> query)
    let tk = token || null;

    if (!tk && req && req.headers && req.headers.authorization) {
      const ah = String(req.headers.authorization || "").trim();
      if (ah.toLowerCase().startsWith("bearer ")) {
        tk = ah.split(" ")[1];
      } else {
        tk = ah; // allow raw token in Authorization header if sent
      }
    }

    if (!tk && req && req.cookies && (req.cookies.session || req.cookies.token)) {
      tk = req.cookies.session || req.cookies.token;
    }

    if (!tk && req && req.query && req.query.token) {
      tk = String(req.query.token);
    }

    if (!tk) return null;

    // Verify token using shared helper (throws on invalid/expired)
    let payload;
    try {
      payload = verifyAuthToken(tk);
    } catch (e) {
      console.warn("getCurrentUserService: token verification failed:", e?.message ?? e);
      return null;
    }

    const userId = payload?.sub ?? payload?.userId ?? payload?.id ?? null;
    if (!userId) return null;

    const user = await User.findById(userId);
    if (!user) return null;

    const normalized = {
      id: String(user._id ?? user.id),
      firstName: user.firstName ?? "",
      lastName: user.lastName ?? "",
      email: user.emailID ?? user.email ?? "",
      avatarUrl: user.avatarUrl ?? null,
      role: user.role ?? "user",
      countryId: user.countryId ?? undefined,
      stateId: user.stateId ?? undefined,
      cityId: user.cityId ?? undefined,
      zip: user.zip ?? undefined,
      createdById: user.createdById ?? null,
    };

    return normalized;
  } catch (err) {
    console.warn("getCurrentUserService error:", err);
    return null;
  }
};

/* -------------------------
   LOGOUT SERVICE (revocation placeholder)
------------------------- */
const revokedTokens = new Set();

export const logoutService = async (token /* string */, req /* optional */) => {
  try {
    if (token) revokedTokens.add(token);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message ?? String(err) };
  }
};

/* -------------------------
   Export all
------------------------- */
export default {
  signupService,
  loginService,
  sendResetPasswordCodeService,
  validateResetPasswordCodeService,
  resetPasswordService,
  getCurrentUserService,
  logoutService,
};
