// src/routes/auth.routes.js

import express from "express";
import {
  signup,
  login,
  getCurrentUser,
  logout,
} from "../controllers/auth.controller.js";

const router = express.Router();

/* ---------------------------------------------------------
   STANDARD AUTH ROUTES (used by React frontend)
--------------------------------------------------------- */

// POST /api/auth/signup
router.post("/auth/signup", signup);

// POST /api/auth/login
router.post("/auth/login", login);

// GET /api/auth/me → frontend calls this to verify token/cookie
router.get("/auth/me", getCurrentUser);

// POST /api/auth/logout
router.post("/auth/logout", logout);

export default router;
