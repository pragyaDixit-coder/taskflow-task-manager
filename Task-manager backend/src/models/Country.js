// src/models/Country.js
import mongoose from "mongoose";

const { Schema } = mongoose;

const countrySchema = new Schema(
  {
    name: { type: String, required: true, maxlength: 50, trim: true },
    // normalized lower-case name for case-insensitive uniqueness checks
    nameLower: { type: String, required: true, trim: true, lowercase: true, index: true },
    isDeleted: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    createdOn: { type: Date, default: Date.now },
    updatedOn: { type: Date, default: Date.now },
  },
  {
    timestamps: false, // you're managing createdOn/updatedOn yourself
    toJSON: {
      virtuals: true,
      transform(doc, ret) {
        // convert _id to id, drop __v and internal fields
        ret.id = ret._id ? String(ret._id) : ret.id;
        delete ret._id;
        delete ret.__v;
        // hide nameLower from API responses (internal canonical field)
        delete ret.nameLower;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
    },
  }
);

/*
  Use normal functions (not arrow) so Mongoose sets `this` correctly.
*/

// Ensure nameLower is always present and updated
countrySchema.pre("save", function (next) {
  try {
    if (this.name && typeof this.name === "string") {
      // keep canonical form in both fields
      this.name = String(this.name).trim();
      this.nameLower = this.name.toLowerCase();
    } else {
      this.nameLower = "";
    }

    // maintain manual timestamps
    this.updatedOn = new Date();
    if (!this.createdOn) this.createdOn = new Date();

    if (typeof next === "function") return next();
    return;
  } catch (err) {
    if (typeof next === "function") return next(err);
    throw err;
  }
});

// Helper for query middleware: set updatedOn in the update object and keep nameLower in sync
function setUpdatedOnForQuery(next) {
  try {
    // For findOneAndUpdate / updateOne etc.
    const update = typeof this.getUpdate === "function" ? this.getUpdate() : null;
    if (update) {
      if (!update.$set) update.$set = {};
      update.$set.updatedOn = new Date();

      // if name is being updated via query, also update nameLower
      const maybeName =
        update.name ?? (update.$set && update.$set.name) ?? (update.$set && update.$set.CountryName);
      if (typeof maybeName === "string") {
        update.$set.name = String(maybeName).trim();
        update.$set.nameLower = String(maybeName).trim().toLowerCase();
      }
    }

    if (typeof next === "function") return next();
    return;
  } catch (err) {
    if (typeof next === "function") return next(err);
    throw err;
  }
}

// Attach query middleware safely
countrySchema.pre("findOneAndUpdate", setUpdatedOnForQuery);
countrySchema.pre("updateOne", setUpdatedOnForQuery);
countrySchema.pre("updateMany", setUpdatedOnForQuery);

// Index: unique nameLower among non-deleted documents only (allows soft-deleted duplicates)
// Use collation for case-insensitive matching when supported by MongoDB.
countrySchema.index(
  { nameLower: 1 },
  {
    unique: true,
    partialFilterExpression: { isDeleted: { $ne: true } },
    name: "uniq_nameLower_active_country",
    // OPTIONAL: enable collation for case-insensitive behavior if your Mongo deployment supports it
    // NOTE: If your MongoDB version doesn't support collation on index creation, remove this field.
    collation: { locale: "en", strength: 2 },
  }
);

/**
 * Optional helper to ensure indexes are created (call this from a one-off migration or during startup)
 * Example usage (in your app startup):
 *   import { Country } from './models/Country';
 *   await Country.syncIndexes();
 *
 * We don't call it automatically here to avoid side-effects at import time.
 */

// Export named model and default
export const Country = mongoose.model("Country", countrySchema);
export default Country;
