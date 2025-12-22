// src/models/State.js
// Hinglish: State master - ek state hamesha kisi country se linked rahegi.
// This schema accepts both Mongo ObjectId and plain string/number for countryID
// to avoid CastError when frontend sends numeric/string country IDs.

import mongoose from "mongoose";
const { Schema } = mongoose;

/** toJSON transform: replace _id with id, remove helper fields */
function docToJSON(doc, ret) {
  if (ret._id) {
    ret.id = String(ret._id);
    delete ret._id;
  }
  // hide internals
  delete ret.nameLower;
  delete ret.__v;
  return ret;
}

const stateSchema = new Schema(
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

    /**
     * countryID: flexible type.
     * - Accepts mongoose ObjectId values OR plain strings/numbers.
     * - We use Schema.Types.Mixed so mongoose doesn't try to cast everything to ObjectId.
     * - The compound index below uses whatever value is stored (string or ObjectId).
     */
    countryID: {
      type: Schema.Types.Mixed,
      required: true,
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: { createdAt: "createdOn", updatedAt: "updatedOn" },
    toJSON: { virtuals: true, versionKey: false, transform: docToJSON },
    toObject: { virtuals: true, versionKey: false, transform: docToJSON },
  }
);

/**
 * Pre-validate hook — normalize name & nameLower.
 * Also coerce countryID to a stable form:
 *  - If value looks like a valid 24-hex ObjectId string -> convert to ObjectId (use `new`).
 *  - Else if value is number-like -> keep as Number
 *  - Else store as trimmed string
 *
 * This avoids Mongoose trying to cast `"3"` into an ObjectId and failing.
 */
stateSchema.pre("validate", function () {
  // normalize name
  if (this.name && typeof this.name === "string") {
    this.name = this.name.trim().replace(/\s+/g, " ");
    this.nameLower = this.name.toLowerCase();
  } else {
    this.nameLower = "";
  }

  // normalize countryID to a stable type but do NOT force ObjectId for everything
  const cid = this.countryID;

  if (cid === undefined || cid === null) {
    // let required validator handle missing
    return;
  }

  try {
    // If already an ObjectId instance, keep it
    if (typeof cid === "object" && cid !== null && cid._bsontype === "ObjectID") {
      return;
    }

    // If looks like ObjectId string -> convert using `new` to avoid the "cannot be invoked without 'new'" error
    if (typeof cid === "string" && mongoose.Types.ObjectId.isValid(cid)) {
      this.countryID = new mongoose.Types.ObjectId(String(cid));
      return;
    }

    // if numeric-like (e.g. "3" or 3), convert to Number
    if (typeof cid === "string" && /^\d+$/.test(cid.trim())) {
      this.countryID = Number(cid);
      return;
    }
    if (typeof cid === "number") {
      // keep as number
      return;
    }

    // otherwise keep as trimmed string
    if (typeof cid === "string") {
      this.countryID = cid.trim();
    }
  } catch (err) {
    // on any error, fallback to trimmed string form if possible
    if (typeof cid === "string") this.countryID = cid.trim();
  }
});

/**
 * Composite unique index: countryID + nameLower
 * Use partialFilterExpression so uniqueness applies only for non-deleted docs.
 * Optionally add collation for case-insensitive index behavior if your MongoDB supports it.
 */
stateSchema.index(
  { countryID: 1, nameLower: 1 },
  {
    unique: true,
    background: true,
    partialFilterExpression: { isDeleted: { $ne: true } },
    name: "uniq_countryid_nameLower_active_state",
    // OPTIONAL: Uncomment the following line if you want the index to use collation
    // and your MongoDB deployment supports it:
    // collation: { locale: "en", strength: 2 },
  }
);

/**
 * Optional: If you need to programmatically ensure indexes on startup (recommended for deployments),
 * call State.syncIndexes() from a migration or startup script.
 *
 * Note: If your DB already contains duplicates, index creation will fail — run a dedupe script first.
 */

const State = mongoose.model("State", stateSchema);

export default State;
export { State };
