// src/services/city.service.js
// Service layer for City management
// - normalizes incoming stateId values (ObjectId / numeric / string)
// - maps DB objects to frontend-friendly shape
// - handles inserts, updates, deletes (with dependency check), lookup and duplicate checks

import mongoose from "mongoose";
import City from "../models/City.js";

/**
 * Normalize incoming stateId (or country/state references).
 * - If already an ObjectId instance -> return as-is
 * - If a valid ObjectId string -> return new ObjectId(...)
 * - If numeric-like string -> return Number(...)
 * - If number -> return number
 * - else trimmed string
 */
const normalizeStateId = (v) => {
  if (v === undefined || v === null) return v;

  // Already an ObjectId instance (BSON)
  if (typeof v === "object" && v !== null && v._bsontype === "ObjectID") {
    return v;
  }

  // Valid ObjectId string -> convert to ObjectId instance using `new`
  if (typeof v === "string" && mongoose.isValidObjectId(v)) {
    try {
      return new mongoose.Types.ObjectId(String(v));
    } catch (err) {
      // fallback: return trimmed string if constructor somehow fails
      return String(v).trim();
    }
  }

  // Numeric-like strings -> convert to Number
  if (typeof v === "string" && /^\d+$/.test(v.trim())) {
    return Number(v.trim());
  }

  // Already a number
  if (typeof v === "number") return v;

  // Otherwise keep trimmed string
  if (typeof v === "string") return v.trim();

  // Fallback: return original value
  return v;
};

const toObjectId = (v) => {
  if (v === undefined || v === null) return null;
  const s = String(v);
  if (!mongoose.isValidObjectId(s)) return null;
  return new mongoose.Types.ObjectId(s);
};

const numberOrNull = (v) => {
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
};

/** Map DB city doc to frontend-friendly object */
const mapCity = (d) =>
  d
    ? {
        id: d._id ? String(d._id) : d.id ?? "",
        name: d.name ?? "",
        stateID: d.stateID ?? d.stateId ?? d.StateID ?? "",
        zipCodes: Array.isArray(d.zipCodes)
          ? d.zipCodes
          : d.zipCode
          ? [d.zipCode]
          : [],
        createdOn: d.createdOn,
        updatedOn: d.updatedOn ?? null,
      }
    : null;

const CityService = {
  /**
   * Get list of cities (or single if id provided)
   * Returns array if no id, or mapped object / null if id provided.
   */
  async getList(id = null) {
    if (id) {
      // Try findById first (safe-guarded)
      try {
        const byId = await City.findById(id).lean();
        if (byId) return mapCity(byId);
      } catch (err) {
        // ignore cast errors and fall back to other lookup
      }

      // fallback: try searching by literal id field
      const docs = await City.find({ $or: [{ _id: id }, { id: id }] }).lean();
      return docs.map(mapCity);
    }

    const docs = await City.find({}).lean();
    return docs.map(mapCity);
  },

  /**
   * Get single city model by id
   */
  async getModel(id) {
    if (!id) return null;
    try {
      const doc = await City.findById(id).lean();
      if (doc) return mapCity(doc);
    } catch (err) {
      // ignore and try alternative
    }
    const doc2 = await City.findOne({ $or: [{ _id: id }, { id: id }] }).lean();
    return doc2 ? mapCity(doc2) : null;
  },

  /**
   * Return lightweight lookup list (for dropdowns)
   */
  async getLookupList() {
    const docs = await City.find({}).select("_id name stateID").lean();
    return docs.map((d) => ({
      id: d._id,
      name: d.name,
      stateID: d.stateID,
    }));
  },

  /**
   * Insert a new city
   * payload: { cityName, stateId, zipCodes }
   * returns InsertedID string
   */
  async insert({ cityName, stateId, zipCodes }, userId = null) {
    const sId = normalizeStateId(stateId);

    const payload = {
      name: cityName ? String(cityName).trim() : "",
      stateID: sId,
      zipCodes: Array.isArray(zipCodes)
        ? zipCodes
        : zipCodes
        ? [zipCodes]
        : [],
      createdBy: userId || null,
    };

    const doc = new City(payload);
    const saved = await doc.save();
    return String(saved._id);
  },

  /**
   * Update existing city
   * payload: { cityID, cityName, stateId, zipCodes }
   * returns { updatedOn } or null if not found
   */
  async update({ cityID, cityName, stateId, zipCodes }, userId = null) {
    if (!cityID) return null;

    const updates = {};
    if (cityName !== undefined) updates.name = String(cityName).trim();
    if (stateId !== undefined) updates.stateID = normalizeStateId(stateId);
    if (zipCodes !== undefined)
      updates.zipCodes = Array.isArray(zipCodes)
        ? zipCodes
        : zipCodes
        ? [zipCodes]
        : [];

    updates.updatedBy = userId || null;

    const updated = await City.findByIdAndUpdate(String(cityID), updates, {
      new: true,
    });
    return updated ? { updatedOn: updated.updatedOn } : null;
  },

  /**
   * Delete city by id with dependency check
   * - If city is referenced anywhere in other collections (cityId/cityID/CityID/City/...),
   *   throw error with statusCode = 409.
   * - Else perform physical delete.
   * returns deletedCount (0 or 1)
   */
  async deleteById(id) {
    if (!id) {
      const err = new Error("id required");
      err.statusCode = 400;
      throw err;
    }

    const strId = String(id);
    const oid = toObjectId(strId);
    if (!oid) {
      const err = new Error("Invalid city id");
      err.statusCode = 400;
      throw err;
    }

    // Build candidate filters (alags-alags field names me bhi check)
    const numericId = numberOrNull(strId);

    const candidateFilters = [
      { cityID: oid },
      { cityId: oid },
      { CityID: oid },
      { CityId: oid },
      { city: oid },
      { City: oid },

      // string based
      { cityID: strId },
      { cityId: strId },
      { CityID: strId },
      { CityId: strId },
      { city: strId },
      { City: strId },

      // numeric based (agar kahin numeric cityId store kiya ho)
      numericId !== null ? { cityId: numericId } : null,
      numericId !== null ? { CityId: numericId } : null,
    ].filter(Boolean);

    // Check all mongoose models except City itself
    const modelNames = mongoose.modelNames();
    const cityModelName = City.modelName || "City";
    const otherModels = modelNames.filter((name) => name !== cityModelName);

    for (const modelName of otherModels) {
      const Model = mongoose.model(modelName);
      try {
        const exists = await Model.findOne({ $or: candidateFilters }).lean();
        if (exists) {
          const err = new Error(
            "City is referenced by other records and cannot be deleted."
          );
          err.statusCode = 409; // Conflict
          throw err;
        }
      } catch (err) {
        // Agar query schema mismatch ki wajah se fail hoti hai,
        // to sirf log karo aur next model pe chalo.
        if (err && err.statusCode === 409) {
          // ye hamara hi custom error hai → direct rethrow
          throw err;
        }
        console.warn(
          `CityService.deleteById: skipping dependency check on model "${modelName}" ->`,
          err?.message || err
        );
      }
    }

    // Agar kahin reference nahi mila → ab safe delete
    const r = await City.deleteOne({ _id: oid });
    return r.deletedCount ?? 0;
  },

  /**
   * Check duplicate city name within a state
   * args: { cityName, stateId, excludeId }
   * returns boolean
   */
  async checkDuplicateCityName({ cityName, stateId, excludeId = null }) {
    if (!cityName || stateId === undefined || stateId === null) return false;

    const sId = normalizeStateId(stateId);

    const filter = {
      stateID: sId,
      nameLower: String(cityName).trim().toLowerCase(),
    };

    if (excludeId) {
      let ex = excludeId;
      try {
        if (
          typeof excludeId === "string" &&
          mongoose.isValidObjectId(excludeId)
        ) {
          ex = new mongoose.Types.ObjectId(String(excludeId));
        }
      } catch (err) {
        // keep original excludeId if normalization fails
      }
      filter._id = { $ne: ex };
    }

    const cnt = await City.countDocuments(filter);
    return cnt > 0;
  },
};

export default CityService;
