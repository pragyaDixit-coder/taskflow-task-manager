// src/app.js
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import currentUserRoutes from "./routes/currentUser.routes.js";
import userManagementRoutes from "./routes/userManagement.routes.js";
import cityManagementCountryRoutes from "./routes/cityManagementCountry.routes.js";
import stateRoutes from "./routes/state.routes.js";
import cityRoutes from "./routes/city.routes.js";

// ⭐⭐⭐ TASK ROUTE ⭐⭐⭐
import taskRoutes from "./routes/task.routes.js";

// ⭐⭐⭐ NEW: Forgot Password Routes ⭐⭐⭐
import forgotPasswordRoutes from "./routes/forgotPassword.routes.js";

import { errorHandler } from "./middlewares/errorHandler.js";

const app = express();

/* ---------------- Environment / config ---------------- */
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "http://localhost:5173";
const API_PREFIX = process.env.API_PREFIX || "/api";
const TRUST_PROXY =
  process.env.TRUST_PROXY === "1" || process.env.TRUST_PROXY === "true";

console.log("🔧 App starting with:", {
  env: process.env.NODE_ENV || "development",
  API_PREFIX,
  FRONTEND_ORIGIN,
  trustProxy: TRUST_PROXY,
});

if (TRUST_PROXY) {
  app.set("trust proxy", 1);
}

/* ---------------- Middlewares ---------------- */
app.use(cookieParser());

const allowedOrigins = new Set([
  FRONTEND_ORIGIN,
  "http://127.0.0.1:5173",
  "http://localhost:5173",
]);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.has(origin)) return callback(null, true);
      console.warn("❌ CORS BLOCKED ORIGIN:", origin);
      return callback(new Error("CORS not allowed from " + origin));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "X-Access-Token",
    ],
    optionsSuccessStatus: 204,
  })
);

// Body parsers
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

/* ---------------- Dev-only request logger ---------------- */
if (process.env.NODE_ENV !== "production") {
  app.use((req, _res, next) => {
    try {
      const shortCookie = req.headers.cookie
        ? String(req.headers.cookie).split(";").slice(0, 2).join("; ")
        : "";
      const authSnippet = String(req.headers.authorization || "").slice(0, 60);
      const bodyKeys =
        req.body && typeof req.body === "object"
          ? Object.keys(req.body)
          : undefined;

      console.log(
        `>>> ${req.method} ${req.originalUrl} - Cookie: ${shortCookie} - Authorization: ${authSnippet}` +
          (bodyKeys ? ` - bodyKeys: ${JSON.stringify(bodyKeys)}` : "")
      );
    } catch (err) {
      console.warn("Dev logger failed to print request preview:", err);
    }
    next();
  });
}

/* ---------------- Health route ---------------- */
app.get("/", (_req, res) => {
  res.json({
    status: "ok",
    env: process.env.NODE_ENV || "development",
    apiPrefix: API_PREFIX,
  });
});


/* ---------------- Mount routers ---------------- */

// Public auth routes
app.use(API_PREFIX, authRoutes);

// Public/protected application routes
app.use(API_PREFIX, userRoutes);
app.use(API_PREFIX, currentUserRoutes);
app.use(API_PREFIX, userManagementRoutes);

// ⭐⭐⭐ NEW: Forgot Password Routes under UserManagement ⭐⭐⭐
// Final endpoints:
// POST   /api/UserManagement/ForgotPassword/SendResetPasswordCode
// GET    /api/UserManagement/ForgotPassword/ValidateResetPasswordCode
// POST   /api/UserManagement/ForgotPassword/ResetPassword
app.use(`${API_PREFIX}/UserManagement/ForgotPassword`, forgotPasswordRoutes);
console.log(`✅ Mounted forgotPassword routes at: ${API_PREFIX}/UserManagement/ForgotPassword`);

// Existing City/State routes
app.use(`${API_PREFIX}/CityManagement`, cityManagementCountryRoutes);
app.use(`${API_PREFIX}/CityManagement/State`, stateRoutes);
app.use(`${API_PREFIX}/CityManagement/City`, cityRoutes);

// ⭐⭐⭐ Task Management Routes ⭐⭐⭐
app.use(`${API_PREFIX}/TaskManagement`, taskRoutes);

/* ---------------- Error handler ---------------- */
app.use(errorHandler);

/* ---------------- Route list (dev only) ---------------- */
function listRoutes() {
  try {
    if (!app._router || !Array.isArray(app._router.stack)) return;

    console.log("----- Registered routes (summary) -----");

    app._router.stack.forEach((layer) => {
      // top-level router layers have .route or a handle stack
      if (layer?.route && layer.route.path) {
        // direct route
        const methods = Object.keys(layer.route.methods).join(",").toUpperCase();
        console.log(`${methods} ${layer.route.path}`);
      } else if (layer?.handle?.stack && layer.name === "router") {
        // nested router - iterate
        layer.handle.stack.forEach((r) => {
          if (r.route && r.route.path) {
            const methods = Object.keys(r.route.methods).join(",").toUpperCase();
            // For nested routers, prepend the parent layer regexp/path if possible.
            // Many express internals store the mount path in layer.regexp or layer?.regexp?.toString()
            console.log(`${methods} ${r.route.path}`);
          }
        });
      }
    });

    console.log("-----------------------------");
  } catch (err) {
    console.warn("listRoutes: failed to enumerate routes:", err);
  }
}

if (process.env.NODE_ENV !== "production") listRoutes();

export default app;
