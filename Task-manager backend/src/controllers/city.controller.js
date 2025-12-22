// src/controllers/city.controller.js
import CityService from "../services/city.service.js";

/**
 * Helper: uniform error responder
 * If service throws custom error with .statusCode or .status → use that
 * else forward to next(err) so global error handler can log/handle it.
 */
const sendServiceError = (res, err) => {
  const status = err?.statusCode ?? err?.status ?? null;
  if (status) {
    return res.status(status).json({ message: err.message ?? "Error" });
  }
  // No status set — let express error middleware handle it
  // but convert to 500 response here for safety
  console.error("Unhandled service error:", err);
  return res.status(500).json({ message: err?.message ?? "Something went wrong" });
};

/* GET /GetList?Id=... */
export const getList = async (req, res, next) => {
  try {
    const id = req.query.Id ?? req.query.id ?? null;
    const result = await CityService.getList(id);
    // If id provided and no result -> 404
    if (id && (!result || (Array.isArray(result) && result.length === 0))) {
      return res.status(404).json({ message: "City not found" });
    }
    return res.json(result);
  } catch (err) {
    // If service attached a status, respond accordingly
    if (err?.statusCode || err?.status) return sendServiceError(res, err);
    next(err);
  }
};

/* GET /GetModel/:id */
export const getModel = async (req, res, next) => {
  try {
    const id = req.params.id ?? req.query.id ?? null;
    if (!id) return res.status(400).json({ message: "id required" });
    const model = await CityService.getModel(id);
    if (!model) return res.status(404).json({ message: "City not found" });
    return res.json(model);
  } catch (err) {
    if (err?.statusCode || err?.status) return sendServiceError(res, err);
    next(err);
  }
};

/* GET /GetLookupList */
export const getLookupList = async (req, res, next) => {
  try {
    const list = await CityService.getLookupList();
    return res.json(list);
  } catch (err) {
    if (err?.statusCode || err?.status) return sendServiceError(res, err);
    next(err);
  }
};

/* POST /Insert */
export const insert = async (req, res, next) => {
  try {
    const userId = req.user?.id ?? null;
    const body = req.body ?? {};
    const cityName = body.cityName ?? body.CityName ?? body.name ?? "";
    const stateId =
      body.stateId ??
      body.StateID ??
      body.StateId ??
      body.stateID ??
      body.stateId ??
      null;
    const zipCodes =
      body.zipCodes ?? body.ZipCodes ?? body.zipCode ?? body.ZipCode ?? [];

    if (!cityName || stateId === undefined || stateId === null || String(stateId).trim() === "") {
      return res.status(400).json({ message: "cityName and stateId required" });
    }

    const insertedId = await CityService.insert({ cityName, stateId, zipCodes }, userId);
    return res.status(201).json({ InsertedID: insertedId });
  } catch (err) {
    // Duplicate key from DB
    if (err?.code === 11000) {
      return res.status(409).json({ message: "City already exists for selected state" });
    }
    if (err?.statusCode || err?.status) return sendServiceError(res, err);
    next(err);
  }
};

/* PUT /Update */
export const update = async (req, res, next) => {
  try {
    const userId = req.user?.id ?? null;
    const body = req.body ?? {};
    const cityID = body.cityID ?? body.cityId ?? body.id ?? null;
    const cityName = body.cityName ?? body.CityName ?? body.name;
    const stateId = body.stateId ?? body.StateID ?? body.StateId ?? undefined;
    const zipCodes = body.zipCodes ?? body.ZipCodes ?? body.zipCode ?? body.ZipCode ?? undefined;

    if (!cityID) return res.status(400).json({ message: "cityID required" });

    const updated = await CityService.update({ cityID, cityName, stateId, zipCodes }, userId);
    if (!updated) return res.status(404).json({ message: "City not found" });

    // Return UpdatedOn consistently if available
    return res.json({ UpdatedOn: updated.updatedOn ?? new Date().toISOString() });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ message: "City already exists for selected state" });
    }
    if (err?.statusCode || err?.status) return sendServiceError(res, err);
    next(err);
  }
};

/* DELETE /Delete/:id */
export const remove = async (req, res, next) => {
  try {
    const id = req.params.id ?? req.query.id ?? null;
    if (!id) return res.status(400).json({ message: "id required" });

    const deletedCount = await CityService.deleteById(id);
    if (!deletedCount) return res.status(404).json({ message: "City not found or already deleted" });

    return res.json({ message: "Deleted" });
  } catch (err) {
    // If service returned conflict due to dependency, forward 409
    if (err?.statusCode === 409 || err?.status === 409) {
      return res.status(409).json({ message: err.message ?? "City is in use and cannot be deleted." });
    }
    if (err?.statusCode || err?.status) return sendServiceError(res, err);
    next(err);
  }
};

/* POST /CheckDuplicateCityName */
export const checkDuplicateCityName = async (req, res, next) => {
  try {
    const body = req.body ?? {};
    const cityName = body.CityName ?? body.cityName ?? "";
    const stateId = body.StateID ?? body.stateId ?? body.StateId ?? null;
    const excludeId = body.ExcludeID ?? body.excludeId ?? null;

    if (!cityName || !stateId) return res.status(400).json({ message: "CityName and StateID required" });

    const isDuplicate = await CityService.checkDuplicateCityName({ cityName, stateId, excludeId });
    return res.json({ IsDuplicate: !!isDuplicate });
  } catch (err) {
    if (err?.statusCode || err?.status) return sendServiceError(res, err);
    next(err);
  }
};
