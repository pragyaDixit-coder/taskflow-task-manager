// src/routes/user.routes.js
// Public user-facing routes (registration etc.)

import express from "express";
import { registerUser } from "../controllers/user.controller.js";
import validators from "../validators/user.validator.js";
import { validate } from "../middlewares/validateRequest.js";

const router = express.Router();

/**
 * Small wrapper so async controllers can throw and errors
 * automatically go to next(err) and your global error handler.
 */
const wrap = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// PDF: POST api/UserManagement/UserRegistration
// Use validator if available; otherwise fallback to no-op
router.post(
  "/UserManagement/UserRegistration",
  validators?.registerValidator ?? ((req, _res, next) => next()),
  validate,
  wrap(registerUser)
);

export default router;
