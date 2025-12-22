// src/controllers/state.controller.js
// Controller for State master routes
// Hinglish: ye controller State related endpoints ko handle karta hai.
// It expects a StateService with methods:
// - getList(id?), getModel(id), getLookupList(),
// - insert({ stateName, countryId }, userId),
// - update({ stateID, stateName, countryId }, userId),
// - deleteById(id), checkDuplicateStateName({ stateName, countryId, excludeId })

import StateService from "../services/state.service.js";

/**
 * GET /api/CityManagement/State/GetList
 * Optional query param: Id or id
 */
export const getList = async (req, res, next) => {
  try {
    const id = req.query.Id ?? req.query.id ?? null;
    const result = await StateService.getList(id);

    // If id provided and no result -> 404
    if (id && (!result || (Array.isArray(result) && result.length === 0))) {
      return res.status(404).json({ message: "State not found" });
    }

    // Return whatever the service returns (array or single object)
    return res.json(result);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/CityManagement/State/GetModel/:id  (or ?id=)
 */
export const getModel = async (req, res, next) => {
  try {
    const id = req.query.id ?? req.params.id ?? null;
    if (!id) return res.status(400).json({ message: "id required" });

    const model = await StateService.getModel(id);
    if (!model) return res.status(404).json({ message: "State not found" });

    return res.json(model);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/CityManagement/State/GetLookupList
 */
export const getLookupList = async (req, res, next) => {
  try {
    const list = await StateService.getLookupList();
    return res.json(list);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/CityManagement/State/Insert
 * Body: { stateName | StateName, countryId | CountryID }
 */
export const insert = async (req, res, next) => {
  try {
    const userId = req.user?.id ?? null;
    const body = req.body ?? {};

    // Accept multiple casing shapes
    const stateName = body.stateName ?? body.StateName ?? "";
    const countryId = body.countryId ?? body.CountryID ?? "";

    if (!stateName || !countryId) {
      return res.status(400).json({ message: "stateName and countryId are required" });
    }

    const insertedId = await StateService.insert(
      { stateName: String(stateName).trim(), countryId: String(countryId) },
      userId
    );

    return res.json({ InsertedID: insertedId });
  } catch (err) {
    // Duplicate key handling
    if (err?.code === 11000) {
      return res.status(409).json({ message: "State name already exists for selected country" });
    }
    next(err);
  }
};

/**
 * PUT /api/CityManagement/State/Update
 * Body: { stateID | stateId | id, stateName | StateName, countryId | CountryID }
 */
export const update = async (req, res, next) => {
  try {
    const userId = req.user?.id ?? null;
    const body = req.body ?? {};

    const stateID = body.stateID ?? body.stateId ?? body.id ?? null;
    if (!stateID) return res.status(400).json({ message: "stateID is required" });

    const stateName = body.stateName ?? body.StateName ?? undefined;
    const countryId = body.countryId ?? body.CountryID ?? undefined;

    const updated = await StateService.update(
      {
        stateID: String(stateID),
        stateName: stateName !== undefined ? String(stateName).trim() : undefined,
        countryId: countryId !== undefined ? String(countryId) : undefined,
      },
      userId
    );

    if (!updated) return res.status(404).json({ message: "State not found" });

    // Try to return UpdatedOn if available, otherwise generic value
    const updatedOn = (updated && updated.updatedOn) || new Date().toISOString();
    return res.json({ UpdatedOn: updatedOn });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ message: "State name already exists for selected country" });
    }
    next(err);
  }
};

/**
 * DELETE /api/CityManagement/State/Delete/:id
 */
export const remove = async (req, res, next) => {
  try {
    const id = req.params.id ?? req.query.id ?? null;
    if (!id) return res.status(400).json({ message: "id required" });

    const deletedCount = await StateService.deleteById(String(id));

    if (!deletedCount) {
      return res.status(404).json({ message: "State not found or already deleted" });
    }

    return res.json({ message: "Deleted" });
  } catch (err) {
    // If service indicates state is referenced elsewhere, return 409 Conflict
    if (err && (err.status === 409 || /referenc|used|cannot delete/i.test(err.message || ""))) {
      return res.status(409).json({
        message:
          err.message ||
          "State is referenced by other records and cannot be deleted.",
      });
    }
    next(err);
  }
};

/**
 * POST /api/CityManagement/State/CheckDuplicateStateName
 * Body: { StateName, CountryID, ExcludeID } OR lowercase variants
 * Response: { IsDuplicate: boolean }
 */
export const checkDuplicateStateName = async (req, res, next) => {
  try {
    const body = req.body ?? {};
    const stateName = body.StateName ?? body.stateName ?? "";
    const countryId = body.CountryID ?? body.countryId ?? "";
    const excludeId = body.ExcludeID ?? body.excludeId ?? null;

    if (!stateName || !countryId) {
      return res.status(400).json({ message: "StateName and CountryID required" });
    }

    const isDuplicate = await StateService.checkDuplicateStateName({
      stateName: String(stateName).trim(),
      countryId: String(countryId),
      excludeId: excludeId ? String(excludeId) : null,
    });

    return res.json({ IsDuplicate: !!isDuplicate });
  } catch (err) {
    next(err);
  }
};
