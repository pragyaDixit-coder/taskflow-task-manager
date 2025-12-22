// src/utils/jwt.js
import jwt from "jsonwebtoken";

/**
 * JWT utility helpers
 *
 * NOTE: For local development we provide a fallback secret. In production
 * you MUST set process.env.JWT_SECRET to a secure value and never rely on
 * the fallback.
 */

const JWT_SECRET = process.env.JWT_SECRET || "super_secret_jwt_key_change_me";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1d";

/**
 * generateAuthToken(userId, extraPayload?, options?)
 * - userId: string|number - stored in `sub` claim
 * - extraPayload: optional object with additional claims (e.g. email, role)
 * - options: optional jwt.sign options override
 *
 * Returns a signed JWT string.
 */
export const generateAuthToken = (userId, extraPayload = {}, options = {}) => {
  const payload = {
    sub: String(userId),
    ...extraPayload,
  };
  const signOpts = { expiresIn: JWT_EXPIRES_IN, ...options };
  return jwt.sign(payload, JWT_SECRET, signOpts);
};

/**
 * verifyAuthToken(token)
 * - Verifies the token and returns decoded payload.
 * - Throws an error if token is invalid or expired.
 *
 * This function is async to match awaiting usage in middleware.
 */
export const verifyAuthToken = async (token) => {
  if (!token) {
    const e = new Error("No token provided");
    e.name = "TokenError";
    throw e;
  }

  try {
    // jwt.verify can throw synchronously; wrap in Promise for async usage.
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded;
  } catch (err) {
    // Normalize the error message a bit for logging while keeping client-facing messages generic.
    const message = err && err.name === "TokenExpiredError"
      ? "TokenExpired"
      : err && err.name === "JsonWebTokenError"
      ? "InvalidToken"
      : "TokenVerificationFailed";

    const e = new Error(message);
    e.original = err;
    e.name = err && err.name ? err.name : "TokenError";
    throw e;
  }
};

/**
 * decodeAuthToken(token)
 * - Returns decoded token payload WITHOUT verifying the signature.
 * - Useful for debugging / non-secure introspection.
 */
export const decodeAuthToken = (token) => {
  if (!token) return null;
  try {
    return jwt.decode(token);
  } catch {
    return null;
  }
};

export default {
  generateAuthToken,
  verifyAuthToken,
  decodeAuthToken,
};
