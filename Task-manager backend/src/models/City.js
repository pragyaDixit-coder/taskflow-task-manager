// src/models/City.js
// City master - a city belongs to a state. Supports multiple zip codes (array of strings).

import mongoose from "mongoose";
const { Schema } = mongoose;

function docToJSON(doc, ret) {
  if (ret._id) {
    ret.id = String(ret._id);
    delete ret._id;
  }
  // hide internal helper fields
  delete ret.nameLower;
  // remove mongoose version key if present
  delete ret.__v;
  return ret;
}

const citySchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      maxlength: 50,
      trim: true,
    },

    // canonical lowercase name for case-insensitive uniqueness
    nameLower: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },

    // stateID: store ObjectId for relation; accept flexible inputs at runtime
    stateID: {
      type: Schema.Types.Mixed,
      required: true,
    },

    // zipCodes: optional array; each code up to 6 chars (trimmed)
    zipCodes: {
      type: [String],
      validate: {
        validator: function (arr) {
          if (!arr) return true;
          if (!Array.isArray(arr)) return false;
          return arr.every(function (z) {
            return typeof z === "string" && z.trim().length > 0 && z.trim().length <= 6;
          });
        },
        message: "Each zip code must be a string up to 6 characters",
      },
      default: [],
    },

    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },

    isDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: { createdAt: "createdOn", updatedAt: "updatedOn" },
    toJSON: { virtuals: true, versionKey: false, transform: docToJSON },
    toObject: { virtuals: true, versionKey: false, transform: docToJSON },
  }
);

/**
 * Normalize name, nameLower, stateID and zipCodes before validation/save.
 * Using pre("validate") so values are normalized even when using create()/save().
 */
citySchema.pre("validate", function () {
  // normalize name and nameLower
  if (this.name && typeof this.name === "string") {
    // collapse multiple spaces, trim
    this.name = this.name.trim().replace(/\s+/g, " ");
    this.nameLower = this.name.toLowerCase();
  } else {
    this.nameLower = "";
  }

  // normalize stateID:
  // - if looks like ObjectId string -> convert to ObjectId instance
  // - if numeric string -> Number
  // - else trimmed string
  const sid = this.stateID;
  if (sid !== null && sid !== undefined) {
    try {
      if (typeof sid === "string" && mongoose.isValidObjectId(sid)) {
        // construct ObjectId instance
        this.stateID = new mongoose.Types.ObjectId(String(sid));
      } else if (typeof sid === "string" && /^\d+$/.test(sid.trim())) {
        this.stateID = Number(sid.trim());
      } else if (typeof sid === "string") {
        this.stateID = sid.trim();
      }
      // if already number or ObjectId instance, leave as-is
    } catch (err) {
      // fallback: keep trimmed string (defensive)
      if (typeof sid === "string") this.stateID = sid.trim();
    }
  }

  // normalize zipCodes entries
  if (Array.isArray(this.zipCodes)) {
    this.zipCodes = this.zipCodes
      .map(function (z) {
        return typeof z === "string" ? z.trim() : "";
      })
      .filter(function (z) {
        return z.length > 0;
      })
      .map(function (z) {
        return z.length > 6 ? z.substring(0, 6) : z;
      });
  }
});

/*
  Composite unique index: stateID + nameLower.
  partialFilterExpression prevents soft-deleted documents from blocking new inserts.
  collation can be added for case-insensitive behavior at the index level when supported
  by your MongoDB deployment; since we store nameLower (lowercase) it's optional.
*/
citySchema.index(
  { stateID: 1, nameLower: 1 },
  {
    unique: true,
    background: true,
    partialFilterExpression: { isDeleted: { $ne: true } },
    name: "uniq_state_nameLower_active_city",
    // OPTIONAL: uncomment the following if you want collation on the index and your MongoDB supports it
    // collation: { locale: "en", strength: 2 },
  }
);

// Optional: if you need to programmatically ensure indexes on startup, call:
// await City.syncIndexes();
// We don't call syncIndexes here to avoid side-effects at import time.

const City = mongoose.model("City", citySchema);

export default City;
export { City };
