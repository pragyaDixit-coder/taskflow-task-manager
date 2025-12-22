// src/routes/forgotPassword.routes.js
import express from "express";
import {
  sendResetPasswordCode,
  validateResetPasswordCode,
  resetPassword,
} from "../controllers/forgotPassword.controller.js";

const router = express.Router();

// Ensure JSON body parsing for these routes (defensive; harmless if already configured globally)
router.use(express.json());

console.log("🔔 [forgotPassword.routes] MODULE LOADED");

// Helper: async wrapper to catch errors from async route handlers
function asyncHandler(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * POST /SendResetPasswordCode
 * Body expected: { EmailID, resetPageBaseUrl? }
 * We trim email early to avoid accidental whitespace mismatches.
 */
router.post(
  "/SendResetPasswordCode",
  asyncHandler(async (req, res, next) => {
    try {
      const bodyKeys = Object.keys(req.body || {});
      console.log(">>> ROUTE HIT: POST /SendResetPasswordCode - bodyKeys:", bodyKeys);

      // Defensive normalization: trim EmailID if present
      if (req.body && (req.body.EmailID || req.body.emailID)) {
        const emailRaw = req.body.EmailID ?? req.body.emailID;
        req.body.EmailID = String(emailRaw ?? "").trim();
      }

      // preview body for debugging (safe length)
      try {
        console.log(">>> ROUTE HIT: req.body preview:", JSON.stringify(req.body).slice(0, 1000));
      } catch (err) {
        console.log(">>> ROUTE HIT: req.body preview: [unserializable]");
      }

      return await sendResetPasswordCode(req, res, next);
    } catch (err) {
      console.error(">>> SendResetPasswordCode route error:", err);
      throw err;
    }
  })
);

/**
 * GET /ValidateResetPasswordCode?code=...
 * We trim the incoming query param to be defensive.
 */
router.get(
  "/ValidateResetPasswordCode",
  asyncHandler(async (req, res, next) => {
    try {
      console.log(">>> ROUTE HIT: GET  /ValidateResetPasswordCode - query:", req.query);

      // Defensive normalization of code query param
      if (req.query && req.query.code) {
        req.query.code = String(req.query.code).trim();
      }

      return await validateResetPasswordCode(req, res, next);
    } catch (err) {
      console.error(">>> ValidateResetPasswordCode route error:", err);
      throw err;
    }
  })
);

/**
 * POST /ResetPassword
 * Body expected: { resetPasswordCode, password }
 * We trim resetPasswordCode and ensure password is a string.
 */
router.post(
  "/ResetPassword",
  asyncHandler(async (req, res, next) => {
    try {
      console.log(">>> ROUTE HIT: POST /ResetPassword - bodyKeys:", Object.keys(req.body || {}));

      // Defensive preview (avoid blowup for large/unserializable bodies)
      try {
        console.log(">>> ROUTE HIT: req.body preview:", JSON.stringify(req.body).slice(0, 1000));
      } catch (e) {
        console.log(">>> ROUTE HIT: req.body preview: [unserializable]");
      }

      // Normalize incoming fields to prevent whitespace/format mismatch
      if (req.body) {
        if (req.body.resetPasswordCode || req.body.ResetPasswordCode) {
          const raw = req.body.resetPasswordCode ?? req.body.ResetPasswordCode;
          req.body.resetPasswordCode = String(raw ?? "").trim();
          // also keep PascalCase variant in case controllers/other code reads it
          req.body.ResetPasswordCode = req.body.resetPasswordCode;
        }
        if (req.body.password) {
          req.body.password = String(req.body.password);
        }
      }

      return await resetPassword(req, res, next);
    } catch (err) {
      console.error(">>> ResetPassword route error:", err);
      throw err;
    }
  })
);

export default router;
