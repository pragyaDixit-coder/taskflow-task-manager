// src/controllers/countryManagement.controller.js
// Hinglish comments — ye file HTTP requests ko service layer se connect karti hai.
// Validate karegi inputs, consistent error responses degi, aur req.user ko use karegi.

import {
  getCountryListService,
  getCountryModelService,
  getCountryLookupListService,
  insertCountryService,
  updateCountryService,
  deleteCountryService,
} from "../services/countryManagement.service.js";

// Common error handler helper — consistent JSON response
const handleError = (res, err) => {
  console.error(err);
  const status = err && (err.statusCode || err.status) ? (err.statusCode || err.status) : 500;
  return res.status(status).json({
    message: err && err.message ? err.message : "Something went wrong",
  });
};

/**
 * 1) /GetList
 * - Accepts optional id via query.id, query.Id, body.id, body.CountryID
 * - Method: GET or POST (we support both)
 * - Returns array (or single object if service returns single item)
 */
export const getCountryListController = async (req, res) => {
  try {
     // --- TEMP DEBUG LOGS (remove after debugging) ---
    console.log(">>> Country/GetList - headers.cookie:", req.headers.cookie);
    console.log(">>> Country/GetList - req.cookies:", req.cookies);
    console.log(">>> Country/GetList - req.user:", req.user);
    console.log(">>> Country/GetList - req.body:", req.body);
    // -------------------------------------------------

    // accept from query or body, support multiple casing variants
    const id =
      req.query?.id ??
      req.query?.Id ??
      req.body?.id ??
      req.body?.CountryID ??
      req.body?.countryID ??
      null;

    const result = await getCountryListService(id ?? undefined);
    return res.json(result);
  } catch (err) {
    return handleError(res, err);
  }
};

/**
 * 2) /GetModel/:id
 * - Return single country model
 * - Also supports GET /GetModel?id=...
 */
export const getCountryModelController = async (req, res) => {
  try {
    const id = req.params?.id ?? req.query?.id ?? null;
    if (!id) return res.status(400).json({ message: "CountryID is required" });

    const result = await getCountryModelService(String(id));
    return res.json(result);
  } catch (err) {
    return handleError(res, err);
  }
};

/**
 * 3) /GetLookupList
 * - Returns dropdown datasource (CountryID, CountryName)
 * - Method: GET (we also allow POST)
 */
export const getCountryLookupListController = async (req, res) => {
  try {
    const result = await getCountryLookupListService();
    return res.json(result);
  } catch (err) {
    return handleError(res, err);
  }
};

/**
 * 4) /Insert
 * - Inserts new country
 * - Expects body: { CountryName: "..." } (we accept other casing too)
 * - Returns: { countryID: ... } with 201 status
 */
export const insertCountryController = async (req, res) => {
  try {
    const currentUserId = req.user?.id ?? null; // authMiddleware should set req.user
    const body = req.body ?? {};

    const CountryName = body?.CountryName ?? body?.countryName ?? body?.name ?? "";

    if (!CountryName || !String(CountryName).trim()) {
      return res.status(400).json({ message: "CountryName is required in body" });
    }

    const result = await insertCountryService({ CountryName: String(CountryName).trim() }, currentUserId);
    return res.status(201).json(result);
  } catch (err) {
    return handleError(res, err);
  }
};

/**
 * 5) /Update
 * - Expects body containing CountryID and CountryName (various casings accepted)
 * - Returns: { updatedOn: ... } or error
 */
export const updateCountryController = async (req, res) => {
  try {
    const currentUserId = req.user?.id ?? null;
    const body = req.body ?? {};

    const CountryID = body?.CountryID ?? body?.countryID ?? body?.id ?? body?.CountryId ?? null;
    const CountryName = body?.CountryName ?? body?.countryName ?? body?.name ?? undefined;

    if (!CountryID) {
      return res.status(400).json({ message: "CountryID is required in body" });
    }
    if (CountryName === undefined || CountryName === null || String(CountryName).trim() === "") {
      return res.status(400).json({ message: "CountryName is required in body" });
    }

    const payload = {
      CountryID: String(CountryID),
      CountryName: String(CountryName).trim(),
    };

    const result = await updateCountryService(payload, currentUserId);
    return res.json(result);
  } catch (err) {
    return handleError(res, err);
  }
};

/**
 * 6) /Delete/:id
 * - Soft-delete country if not used by states/cities (service handles dependency check)
 */
export const deleteCountryController = async (req, res) => {
  try {
    const id = req.params?.id ?? req.query?.id ?? null;
    if (!id) return res.status(400).json({ message: "CountryID is required in params" });

    const currentUserId = req.user?.id ?? null;
    const result = await deleteCountryService(String(id), currentUserId);
    return res.json(result);
  } catch (err) {
    return handleError(res, err);
  }
};
