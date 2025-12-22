// src/services/countryManagement.service.js
// Hinglish: Ye file Country CRUD + lookup ke pure business logic ko handle karegi.

import mongoose from "mongoose";
import Country from "../models/Country.js";
import State from "../models/State.js";
import City from "../models/City.js";

// --------------------------------------
// Length helper (same style like userManagement)
// --------------------------------------
const ensureMaxLength = (fieldName, value, max) => {
  if (value && value.length > max) {
    const err = new Error(`${fieldName} must be ${max} characters or fewer.`);
    err.statusCode = 400;
    throw err;
  }
};

/**
 * Safely convert input to ObjectId when appropriate.
 * - if v is null/undefined -> return null
 * - if already ObjectId-like -> return as-is
 * - if valid ObjectId string -> return new ObjectId(...)
 * - otherwise return null (caller can still use string fallback)
 */
const toObjectIdIfValid = (v) => {
  if (v === undefined || v === null) return null;

  // if it's already an ObjectId instance (BSON)
  if (typeof v === "object" && v !== null && (v._bsontype === "ObjectID" || v.constructor?.name === "ObjectId")) {
    return v;
  }

  const s = String(v);
  if (mongoose.isValidObjectId(s)) {
    try {
      // IMPORTANT: construct with `new` to avoid the "cannot be invoked without 'new'" error
      return new mongoose.Types.ObjectId(s);
    } catch (err) {
      // fallback to null and let caller use string fallback
      return null;
    }
  }

  // Not a valid ObjectId string -> return null (use string fallback in queries)
  return null;
};

// --------------------------------------
// 1) GetList: saare countries (optional ID)
// --------------------------------------
export const getCountryListService = async (optionalId) => {
  try {
    const filter = { isDeleted: { $ne: true } };

    if (optionalId) {
      const oid = toObjectIdIfValid(optionalId);
      if (oid) {
        // match by real _id (ObjectId) or by string form (some records might be stored differently)
        filter.$or = [{ _id: oid }, { _id: String(optionalId) }];
      } else {
        filter._id = String(optionalId);
      }
    }

    const countries = await Country.find(filter)
      .populate("createdBy", "firstName lastName")
      .populate("updatedBy", "firstName lastName")
      .sort({ createdOn: -1 })
      .lean();

    return countries.map((c) => ({
      countryID: c._id,
      countryName: c.name,
      createdOn: c.createdOn,
      createdByUserName: c.createdBy
        ? `${c.createdBy.firstName} ${c.createdBy.lastName}`.trim()
        : "",
      updatedOn: c.updatedOn,
      updatedByUserName: c.updatedBy
        ? `${c.updatedBy.firstName} ${c.updatedBy.lastName}`.trim()
        : "",
    }));
  } catch (err) {
    console.error("getCountryListService error:", err);
    throw err;
  }
};

// --------------------------------------
// 2) GetModel by ID
// --------------------------------------
export const getCountryModelService = async (id) => {
  try {
    const oid = toObjectIdIfValid(id);
    const filter = oid ? { $or: [{ _id: oid }, { _id: String(id) }] } : { _id: String(id) };

    const country = await Country.findOne(filter)
      .populate("createdBy", "firstName lastName")
      .populate("updatedBy", "firstName lastName")
      .lean();

    if (!country || country.isDeleted) {
      const err = new Error("Country not found");
      err.statusCode = 404;
      throw err;
    }

    return {
      countryID: country._id,
      countryName: country.name,
      createdOn: country.createdOn,
      createdByUserName: country.createdBy
        ? `${country.createdBy.firstName} ${country.createdBy.lastName}`.trim()
        : "",
      updatedOn: country.updatedOn,
      updatedByUserName: country.updatedBy
        ? `${country.updatedBy.firstName} ${country.updatedBy.lastName}`.trim()
        : "",
    };
  } catch (err) {
    console.error("getCountryModelService error:", err);
    throw err;
  }
};

// --------------------------------------
// 3) GetLookupList (dropdown datasource)
// --------------------------------------
export const getCountryLookupListService = async () => {
  try {
    const countries = await Country.find({ isDeleted: { $ne: true } })
      .sort({ name: 1 })
      .lean();

    return countries.map((c) => ({
      countryID: c._id,
      countryName: c.name,
    }));
  } catch (err) {
    console.error("getCountryLookupListService error:", err);
    throw err;
  }
};

// --------------------------------------
// 4) Insert Country
// Route: /CityManagement/Country/Insert
// --------------------------------------
export const insertCountryService = async (payload, currentUserId) => {
  try {
    let { CountryName } = payload || {};
    CountryName = (CountryName || "").trim();

    if (!CountryName) {
      const err = new Error("Country Name is required.");
      err.statusCode = 400;
      throw err;
    }

    ensureMaxLength("Country Name", CountryName, 50);

    // FIRST: try to find an existing document with same name (including deleted)
    const existing = await Country.findOne({ name: CountryName }).lean();

    // If exists AND active => conflict
    if (existing && !existing.isDeleted) {
      const err = new Error("Country Name is already registered.");
      err.statusCode = 409;
      throw err;
    }

    // If exists but soft-deleted => RESTORE it (preferred UX)
    if (existing && existing.isDeleted) {
      const doc = await Country.findById(existing._id);
      if (doc) {
        doc.isDeleted = false;
        doc.name = CountryName; // ensure normalized name
        // Ensure nameLower if schema requires it
        if (doc.name && (doc.nameLower === undefined || doc.nameLower === null || String(doc.nameLower).trim() === "")) {
          doc.nameLower = String(CountryName).trim().toLowerCase();
        }
        doc.updatedBy = currentUserId || null;
        doc.updatedOn = new Date();
        await doc.save();
        return { countryID: doc._id };
      }
    }

    // Otherwise create new document
    const now = new Date();
    const country = await Country.create({
      name: CountryName,
      // set nameLower if schema expects it (defensive)
      ...(CountryName ? { nameLower: String(CountryName).trim().toLowerCase() } : {}),
      isDeleted: false,
      createdBy: currentUserId || null,
      updatedBy: currentUserId || null,
      createdOn: now,
      updatedOn: now,
    });
    return { countryID: country._id };
  } catch (err) {
    console.error("insertCountryService error:", err);
    if (err && err.code === 11000) {
      const e = new Error("Country Name is already registered.");
      e.statusCode = 409;
      throw e;
    }
    throw err;
  }
};

// --------------------------------------
// 5) Update Country
// Route: /CityManagement/Country/Update
// --------------------------------------
export const updateCountryService = async (payload, currentUserId) => {
  try {
    let { CountryID, CountryName } = payload || {};

    if (!CountryID) {
      const err = new Error("CountryID is required.");
      err.statusCode = 400;
      throw err;
    }

    CountryName = (CountryName || "").trim();

    if (!CountryName) {
      const err = new Error("Country Name is required.");
      err.statusCode = 400;
      throw err;
    }

    ensureMaxLength("Country Name", CountryName, 50);

    // Duplicate check (exclude current country)
    const oid = toObjectIdIfValid(CountryID);
    const dupFilter = oid
      ? { name: CountryName, _id: { $ne: oid }, isDeleted: { $ne: true } }
      : { name: CountryName, _id: { $ne: String(CountryID) }, isDeleted: { $ne: true } };

    const duplicate = await Country.findOne(dupFilter).lean();
    if (duplicate) {
      const err = new Error("Country Name is already registered.");
      err.statusCode = 409;
      throw err;
    }

    const country = await Country.findOne(oid ? { _id: oid } : { _id: String(CountryID) });
    if (!country || country.isDeleted) {
      const err = new Error("Country not found");
      err.statusCode = 404;
      throw err;
    }

    country.name = CountryName;
    // ensure nameLower if schema requires it
    if (!country.nameLower || String(country.nameLower).trim() === "") {
      country.nameLower = String(CountryName).trim().toLowerCase();
    }
    country.updatedBy = currentUserId || null;
    country.updatedOn = new Date();

    await country.save();

    return { updatedOn: country.updatedOn };
  } catch (err) {
    console.error("updateCountryService error:", err);
    if (err && err.code === 11000) {
      const e = new Error("Country Name is already registered.");
      e.statusCode = 409;
      throw e;
    }
    throw err;
  }
};

// --------------------------------------
// 6) Delete Country (Soft Delete + Dependency Check)
// Route: /CityManagement/Country/Delete/{ID}
// --------------------------------------
export const deleteCountryService = async (id, currentUserId) => {
  try {
    if (!id) {
      const e = new Error("CountryID is required");
      e.statusCode = 400;
      throw e;
    }

    const oid = toObjectIdIfValid(id);
    const country = await Country.findOne(oid ? { _id: oid } : { _id: String(id) });

    if (!country || country.isDeleted) {
      const err = new Error("Country not found");
      err.statusCode = 404;
      throw err;
    }

    // 1) Check for any ACTIVE state directly referencing this country
    // support both ObjectId and string-stored country refs
    const stateFilter = oid
      ? { $or: [{ countryID: oid }, { countryID: String(id) }], isDeleted: { $ne: true } }
      : { countryID: String(id), isDeleted: { $ne: true } };

    const activeState = await State.findOne(stateFilter).lean();

    if (activeState) {
      const err = new Error("Country is in use (has active states) and cannot be deleted.");
      err.statusCode = 409; // Conflict
      throw err;
    }

    // 2) Additionally check cities under any states of this country
    // Find all states (active or deleted) for this country and check cities referencing those states
    const statesOfCountry = await State.find(oid ? { $or: [{ countryID: oid }, { countryID: String(id) }] } : { countryID: String(id) }).select("_id").lean();
    const stateIds = (statesOfCountry || []).map((s) => s._id).filter(Boolean);

    if (stateIds.length > 0) {
      // Build a flexible city filter:
      // - ObjectId matching
      // - string matching
      // - numeric matching (if some stateIDs are numeric)
      const objectIdStateIds = stateIds.filter((sid) => mongoose.isValidObjectId(String(sid))).map((sid) => {
        try { return new mongoose.Types.ObjectId(String(sid)); } catch (e) { return null; }
      }).filter(Boolean);

      const stringStateIds = stateIds.map((s) => String(s)).filter(Boolean);

      const numericStateIds = stateIds.map((s) => {
        const n = Number(String(s));
        return Number.isNaN(n) ? null : n;
      }).filter((n) => n !== null);

      const orClauses = [];
      if (objectIdStateIds.length) orClauses.push({ stateID: { $in: objectIdStateIds } });
      if (stringStateIds.length) orClauses.push({ stateID: { $in: stringStateIds } });
      if (numericStateIds.length) orClauses.push({ stateID: { $in: numericStateIds } });

      const cityQuery = orClauses.length > 0 ? { $or: orClauses, isDeleted: { $ne: true } } : { stateID: { $in: stateIds }, isDeleted: { $ne: true } };

      const cityUsing = await City.findOne(cityQuery).lean();
      if (cityUsing) {
        const err = new Error("Country is in use (has cities under its states) and cannot be deleted.");
        err.statusCode = 409;
        throw err;
      }
    }

    // Safe to soft-delete
    // Ensure nameLower exists if schema requires it (prevents validation error on save)
    try {
      if ((!country.nameLower || String(country.nameLower).trim() === "") && country.name) {
        country.nameLower = String(country.name).trim().toLowerCase();
      }

      country.isDeleted = true;
      country.updatedBy = currentUserId || null;
      country.updatedOn = new Date();

      // Try regular save (this may run validations)
      await country.save();
    } catch (saveErr) {
      // If save fails due to validation (e.g. required fields missing), fallback to atomic update
      console.warn("country.save() failed during delete; falling back to findByIdAndUpdate", saveErr);

      const updateObj = {
        isDeleted: true,
        updatedBy: currentUserId || null,
        updatedOn: new Date(),
      };

      if ((!country.nameLower || String(country.nameLower).trim() === "") && country.name) {
        updateObj.nameLower = String(country.name).trim().toLowerCase();
      }

      // Perform atomic update (avoid running document validators)
      await Country.findByIdAndUpdate(country._id, { $set: updateObj });
    }

    return { message: "Country deleted successfully" };
  } catch (err) {
    console.error("deleteCountryService error:", err);
    throw err;
  }
};
