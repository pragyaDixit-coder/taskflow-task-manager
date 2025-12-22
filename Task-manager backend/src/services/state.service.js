// src/services/state.service.js
import { State } from "../models/State.js";
import City from "../models/City.js";
import mongoose from "mongoose";

/**
 * Helpers
 */
const toObjectIdOrNull = (v) => {
  if (v === undefined || v === null) return null;
  const s = String(v);
  if (mongoose.isValidObjectId(s)) return new mongoose.Types.ObjectId(s);
  return null;
};

const strOrNull = (v) => (v === undefined || v === null ? null : String(v));

/**
 * StateService
 */
class StateService {
  static async getList(id) {
    try {
      if (id) {
        const sid = strOrNull(id);
        // try as ObjectId first
        if (mongoose.isValidObjectId(sid)) {
          const doc = await State.findById(new mongoose.Types.ObjectId(sid)).lean();
          return doc ? doc : null;
        }
        // fallback: find by custom id field or string _id
        const docs = await State.find({ $or: [{ _id: sid }, { id: sid }] }).lean();
        return docs.length === 1 ? docs[0] : docs;
      }
      // non-deleted only for list
      return await State.find({ isDeleted: { $ne: true } }).sort({ name: 1 }).lean();
    } catch (err) {
      console.error("StateService.getList error:", err);
      throw err;
    }
  }

  static async getModel(id) {
    try {
      if (!id) return null;
      const sid = strOrNull(id);
      if (!mongoose.isValidObjectId(sid)) return null;
      return await State.findById(new mongoose.Types.ObjectId(sid)).lean();
    } catch (err) {
      console.error("StateService.getModel error:", err);
      throw err;
    }
  }

  static async getLookupList() {
    try {
      return await State.find({ isDeleted: { $ne: true } })
        .select({ _id: 1, name: 1, countryID: 1 })
        .sort({ name: 1 })
        .lean();
    } catch (err) {
      console.error("StateService.getLookupList error:", err);
      throw err;
    }
  }

  static async insert(data = {}, userId = null) {
    try {
      const stateName = String(data.stateName ?? data.StateName ?? "").trim();
      if (!stateName) {
        const e = new Error("stateName is required");
        e.statusCode = 400;
        throw e;
      }

      const countryRaw = data.countryId ?? data.CountryID ?? null;
      if (!countryRaw) {
        const e = new Error("countryId is required");
        e.statusCode = 400;
        throw e;
      }

      const countryID = toObjectIdOrNull(countryRaw) ?? countryRaw;

      const doc = new State({
        name: stateName,
        countryID,
        createdBy: userId || null,
      });

      const saved = await doc.save();
      return String(saved._id);
    } catch (err) {
      // duplicate key handling bubble up for controller
      console.error("StateService.insert error:", err);
      throw err;
    }
  }

  static async update(data = {}, userId = null) {
    try {
      const stateID = data.stateID ?? data.stateId ?? data.id ?? null;
      if (!stateID) {
        const e = new Error("stateID is required");
        e.statusCode = 400;
        throw e;
      }
      const sid = String(stateID);
      if (!mongoose.isValidObjectId(sid)) {
        const e = new Error("Invalid stateID");
        e.statusCode = 400;
        throw e;
      }

      const updates = {};
      if (data.stateName !== undefined) updates.name = String(data.stateName).trim();

      if (data.countryId !== undefined || data.CountryID !== undefined) {
        const countryRaw = data.countryId ?? data.CountryID;
        const countryID = toObjectIdOrNull(countryRaw) ?? countryRaw;
        updates.countryID = countryID;
      }

      updates.updatedBy = userId || null;
      updates.updatedOn = new Date();

      const updated = await State.findByIdAndUpdate(
        new mongoose.Types.ObjectId(sid),
        updates,
        { new: true, runValidators: true }
      );

      return updated;
    } catch (err) {
      console.error("StateService.update error:", err);
      throw err;
    }
  }

  /**
   * Deletes the state (physical delete). Before deleting we check dependencies in City.
   * If any active City references this state, throws statusCode = 409.
   */
  static async deleteById(id) {
    try {
      if (!id) {
        const e = new Error("id required");
        e.statusCode = 400;
        throw e;
      }
      const sid = String(id);
      if (!mongoose.isValidObjectId(sid)) {
        const e = new Error("Invalid id");
        e.statusCode = 400;
        throw e;
      }
      const oid = new mongoose.Types.ObjectId(sid);

      // Build filters to catch different shapes in City collection
      const possibleFilters = [
        { stateID: oid }, // ObjectId field
        { stateId: sid }, // string field
      ];
      // also try numeric if id is numeric string
      const asNum = Number(sid);
      if (!Number.isNaN(asNum)) possibleFilters.push({ stateId: asNum });

      const cityUsing = await City.findOne({ $or: possibleFilters, isDeleted: { $ne: true } }).lean();
      if (cityUsing) {
        const e = new Error("State is referenced by other records and cannot be deleted.");
        e.statusCode = 409;
        throw e;
      }

      // If you prefer soft-delete, change this to update isDeleted=true
      const res = await State.deleteOne({ _id: oid });
      return res.deletedCount ?? 0;
    } catch (err) {
      console.error("StateService.deleteById error:", err);
      throw err;
    }
  }

  /**
   * Duplicate name check (case-insensitive within same country)
   * args: { stateName, countryId, excludeId }
   */
  static async checkDuplicateStateName({ stateName, countryId, excludeId }) {
    try {
      if (!stateName || !countryId) return false;

      const nameLower = String(stateName).trim().toLowerCase();
      const countryID = toObjectIdOrNull(countryId) ?? countryId;

      const filter = {
        nameLower,
        countryID,
      };

      if (excludeId) {
        const ex = String(excludeId);
        if (mongoose.isValidObjectId(ex)) filter._id = { $ne: new mongoose.Types.ObjectId(ex) };
        else filter._id = { $ne: ex };
      }

      const count = await State.countDocuments(filter);
      return count > 0;
    } catch (err) {
      console.error("StateService.checkDuplicateStateName error:", err);
      throw err;
    }
  }
}

export default StateService;
