// src/routes/city.routes.js
import express from "express";
import * as controller from "../controllers/city.controller.js";
import validators from "../validators/city.validator.js";
import { validate } from "../middlewares/validateRequest.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

/**
 * Wrapper to catch async errors and forward to next(err).
 * Keeps controllers simple (no try/catch everywhere).
 */
const wrap = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * City routes (mounted under /api/CityManagement/City)
 *
 * - Supports both GET and POST for GetList to be backward-compatible.
 * - All routes protected with authMiddleware (requires cookie or Bearer token).
 */

// LIST - support GET (query) and POST (body)
router.get("/GetList", authMiddleware, wrap(controller.getList));
router.post("/GetList", authMiddleware, wrap(controller.getList)); // body-friendly

// Get single model
router.get("/GetModel/:id", authMiddleware, wrap(controller.getModel));

// Lookup list for dropdowns
router.get("/GetLookupList", authMiddleware, wrap(controller.getLookupList));

// Insert
router.post(
  "/Insert",
  authMiddleware,
  validators?.insertValidator ?? ((req, _res, next) => next()),
  validate,
  wrap(controller.insert)
);

// Update
router.put(
  "/Update",
  authMiddleware,
  validators?.updateValidator ?? ((req, _res, next) => next()),
  validate,
  wrap(controller.update)
);

// Delete
router.delete("/Delete/:id", authMiddleware, wrap(controller.remove));

// Duplicate check
router.post(
  "/CheckDuplicateCityName",
  authMiddleware,
  validators?.checkDuplicateValidator ?? ((req, _res, next) => next()),
  validate,
  wrap(controller.checkDuplicateCityName)
);

export default router;
