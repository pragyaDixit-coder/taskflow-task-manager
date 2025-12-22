// src/routes/currentUser.routes.js
// Hinglish: CurrentUser ke sab routes yaha define karenge.

import express from "express";
import {
  getCurrentUser,
  updateCurrentUser,
  checkDuplicateEmailID,
} from "../controllers/currentUser.controller.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

/**
 * Small wrapper so async controllers can throw and errors
 * automatically next(err) me chale jayein.
 */
const wrap = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Base: /api (app.js me app.use("/api", currentUserRoutes);)
// Full paths:
//  - GET    /api/UserManagement/CurrentUser/GetModel
//  - PUT    /api/UserManagement/CurrentUser/Update
//  - POST   /api/UserManagement/CurrentUser/CheckDuplicateEmailID

// 1) /GetModel
// GET api/UserManagement/CurrentUser/GetModel
router.get(
  "/UserManagement/CurrentUser/GetModel",
  authMiddleware,
  wrap(getCurrentUser)
);

// 2) /Update
// PUT api/UserManagement/CurrentUser/Update
router.put(
  "/UserManagement/CurrentUser/Update",
  authMiddleware,
  wrap(updateCurrentUser)
);

// 3) /CheckDuplicateEmailID
// POST api/UserManagement/CurrentUser/CheckDuplicateEmailID
router.post(
  "/UserManagement/CurrentUser/CheckDuplicateEmailID",
  authMiddleware,
  wrap(checkDuplicateEmailID)
);

export default router;
