// src/controllers/user.controller.js
// Hinglish: yaha HTTP request/response handle karenge, logic service me hai.

import { registerUserService } from "../services/user.service.js";

/**
 * Register user controller
 * - Calls service and returns 201 on success.
 * - Handles expected service errors (err.statusCode) with friendly JSON responses.
 * - Unexpected errors are forwarded to the global error handler via next(err).
 */
export const registerUser = async (req, res, next) => {
  try {
    const result = await registerUserService(req.body);

    // 201 => resource created
    return res.status(201).json({
      message: "User registered successfully",
      user: result,
    });
  } catch (err) {
    // If service threw an error with statusCode (400/409 etc.), return structured json
    if (err && (err.statusCode || err.status)) {
      const status = err.statusCode || err.status || 400;
      // Keep response minimal and friendly; include field info if present on error
      const payload = {
        message: err.message || "Request failed",
      };

      // If the service attached additional info (e.g., field), include it for client-side mapping
      if (err.field) {
        payload.field = err.field;
      }
      if (err.errorResponse) {
        payload.errorResponse = err.errorResponse;
      }

      return res.status(status).json(payload);
    }

    // Unknown/unexpected error -> forward to global error handler (will produce 500)
    return next(err);
  }
};

export default {
  registerUser,
};
