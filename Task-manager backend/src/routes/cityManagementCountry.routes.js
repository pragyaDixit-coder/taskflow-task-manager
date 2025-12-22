// src/routes/cityManagementCountry.routes.js
// Hinglish: CityManagement module ke andar Country related saare endpoints yaha define honge.

import express from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import {
  getCountryListController,
  getCountryModelController,
  getCountryLookupListController,
  insertCountryController,
  updateCountryController,
  deleteCountryController,
} from "../controllers/countryManagement.controller.js";

const router = express.Router();

/**
 * Wrapper to catch async errors and forward to next(err)
 * (Prevents "UnhandledPromiseRejection" and ensures Express error handlers run)
 */
const wrap = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// NOTE: Mount this router in server.js as:
// app.use("/api/CityManagement", cityManagementCountryRoutes);
// Then full paths become:
// POST  /api/CityManagement/Country/GetList
// GET   /api/CityManagement/Country/GetModel/:id
// GET   /api/CityManagement/Country/GetLookupList
// POST  /api/CityManagement/Country/Insert
// PUT   /api/CityManagement/Country/Update
// DELETE /api/CityManagement/Country/Delete/:id

// If you want to debug routes WITHOUT auth, temporarily remove `authMiddleware`
// e.g. router.post("/Country/GetList", wrap(getCountryListController));

// 1) /GetList  (optional ID via body or query)

router.post(
  "/Country/GetList",
  authMiddleware,
  wrap(getCountryListController)
);

// 2) /GetModel/{ID}
router.get(
  "/Country/GetModel/:id",
  authMiddleware,
  wrap(getCountryModelController)
);

// 3) /GetLookupList
router.get(
  "/Country/GetLookupList",
  authMiddleware,
  wrap(getCountryLookupListController)
);

// 4) /Insert
router.post(
  "/Country/Insert",
  authMiddleware,
  wrap(insertCountryController)
);

// 5) /Update
router.put(
  "/Country/Update",
  authMiddleware,
  wrap(updateCountryController)
);

// 6) /Delete/{ID}
router.delete(
  "/Country/Delete/:id",
  authMiddleware,
  wrap(deleteCountryController)
);

export default router;
