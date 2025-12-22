// src/routes/state.routes.js
import express from "express";
import * as controller from "../controllers/state.controller.js";
import { validate } from "../middlewares/validateRequest.js";
import validators from "../validators/state.validator.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

/**
 * Wrapper to catch async errors and forward to next(err)
 */
const wrap = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * State routes (mounted under /api/CityManagement/State)
 *
 * Supports both GET and POST for GetList to be compatible with different clients.
 */

// LIST - support both GET (query) and POST (body)
router.get("/GetList", authMiddleware, wrap(controller.getList));
router.post("/GetList", authMiddleware, wrap(controller.getList)); // supports body filters

// GET model by route param
router.get("/GetModel/:id", authMiddleware, wrap(controller.getModel));

// GET lookup list for dropdowns
router.get("/GetLookupList", authMiddleware, wrap(controller.getLookupList));

// INSERT - validation middleware applied
router.post(
  "/Insert",
  authMiddleware,
  validators?.insertValidator ?? ((req, _res, next) => next()),
  validate,
  wrap(controller.insert)
);

// UPDATE - validation middleware applied
router.put(
  "/Update",
  authMiddleware,
  validators?.updateValidator ?? ((req, _res, next) => next()),
  validate,
  wrap(controller.update)
);

// DELETE
router.delete("/Delete/:id", authMiddleware, wrap(controller.remove));

// CHECK DUPLICATE - validation middleware applied
router.post(
  "/CheckDuplicateStateName",
  authMiddleware,
  validators?.checkDuplicateValidator ?? ((req, _res, next) => next()),
  validate,
  wrap(controller.checkDuplicateStateName)
);

export default router;
