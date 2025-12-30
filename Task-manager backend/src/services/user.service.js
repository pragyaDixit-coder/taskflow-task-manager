// src/services/user.service.js
// Robust register service — aggressive fallback lookups to avoid E11000 duplicates.
// No transactions, works on standalone Mongo.

import { User } from "../models/User.js";
import { Country } from "../models/Country.js";
import { State } from "../models/State.js";
import { City } from "../models/City.js";
import { hashPassword } from "../utils/password.js";
import { sendRegistrationEmail } from "./email.service.js";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const passwordPolicyRegex =
  /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_\-+=[\]{};':"\\|,.<>/?`~]).{8,18}$/;

function ensureMaxLength(fieldName, value, max) {
  if (value && value.length > max) {
    const err = new Error(`${fieldName} must be ${max} characters or fewer.`);
    err.statusCode = 400;
    throw err;
  }
}

function canonicalNameRaw(name) {
  // normalize: trim, collapse spaces, lowercase
  if (!name) return "";
  return String(name).trim().replace(/\s+/g, " ").toLowerCase();
}
function canonicalName(name) {
  return canonicalNameRaw(name || "");
}
function displayNameNormalized(name) {
  // trimmed + collapsed but preserve case for human-friendly storage
  if (!name) return "";
  return String(name).trim().replace(/\s+/g, " ");
}
function escapeRegex(str = "") {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const DEFAULT_COLLATION = { locale: "en", strength: 2 };

/* ---------- Helper: multi-step find-or-create with robust fallbacks ---------- */

/**
 * tryFindCountryByName: attempts multiple lookups (nameLower, name regex)
 */
async function tryFindCountryByName(name) {
  const nl = canonicalName(name);
  // 1) exact nameLower
  let doc = await Country.findOne({ nameLower: nl, isDeleted: { $ne: true } }).collation(DEFAULT_COLLATION).exec();
  if (doc) return doc;
  // 2) case-insensitive regex on display name
  doc = await Country.findOne({ name: { $regex: `^${escapeRegex(displayNameNormalized(name))}$`, $options: "i" }, isDeleted: { $ne: true } }).exec();
  if (doc) return doc;
  return null;
}

async function createOrGetCountry(name) {
  const display = displayNameNormalized(name);
  const nl = canonicalName(name);

  // try find first (handles existing duplicates)
  let existing = await tryFindCountryByName(name);
  if (existing) return existing;

  // upsert
  try {
    const doc = await Country.findOneAndUpdate(
      { nameLower: nl, isDeleted: { $ne: true } },
      { $setOnInsert: { name: display, nameLower: nl } },
      { upsert: true, new: true, setDefaultsOnInsert: true, collation: DEFAULT_COLLATION }
    ).exec();

    if (doc) return doc;
  } catch (err) {
    // If E11000, try recover by reading err.keyValue and fallbacks
    if (err && err.code === 11000) {
      console.warn("[register] Country upsert E11000:", err.keyValue || err);
      if (err.keyValue && err.keyValue.nameLower) {
        const found = await Country.findOne({ nameLower: err.keyValue.nameLower, isDeleted: { $ne: true } }).exec();
        if (found) return found;
      }
      const fallback = await tryFindCountryByName(name);
      if (fallback) return fallback;
    }
    throw err;
  }
  throw new Error("Country find/create failed");
}

/* State: similar pattern, but keyed by countryID + nameLower */
async function tryFindState(countryId, name) {
  const nl = canonicalName(name);
  // 1) exact
  let doc = await State.findOne({ countryID: countryId, nameLower: nl, isDeleted: { $ne: true } }).collation(DEFAULT_COLLATION).exec();
  if (doc) return doc;
  // 2) regex on name within country
  doc = await State.findOne({
    countryID: countryId,
    name: { $regex: `^${escapeRegex(displayNameNormalized(name))}$`, $options: "i" },
    isDeleted: { $ne: true },
  }).exec();
  if (doc) return doc;
  // 3) cross-check by searching state with that nameLower in any country then filter by countryId string match (defensive)
  doc = await State.findOne({ nameLower: nl, isDeleted: { $ne: true } }).exec();
  if (doc && String(doc.countryID) === String(countryId)) return doc;
  return null;
}
async function createOrGetState(countryId, name) {
  const display = displayNameNormalized(name);
  const nl = canonicalName(name);

  let existing = await tryFindState(countryId, name);
  if (existing) return existing;

  try {
    const doc = await State.findOneAndUpdate(
      { countryID: countryId, nameLower: nl, isDeleted: { $ne: true } },
      { $setOnInsert: { name: display, nameLower: nl, countryID: countryId } },
      { upsert: true, new: true, setDefaultsOnInsert: true, collation: DEFAULT_COLLATION }
    ).exec();
    if (doc) return doc;
  } catch (err) {
    if (err && err.code === 11000) {
      console.warn("[register] State upsert E11000:", err.keyValue || err);
      if (err.keyValue) {
        // try keyValue lookup
        const kv = err.keyValue;
        if (kv.countryID && kv.nameLower) {
          const found = await State.findOne({ countryID: kv.countryID, nameLower: kv.nameLower, isDeleted: { $ne: true } }).exec();
          if (found) return found;
        }
      }
      const fallback = await tryFindState(countryId, name);
      if (fallback) return fallback;
    }
    throw err;
  }
  throw new Error("State find/create failed");
}

/* City: stateID + nameLower */
async function tryFindCity(stateId, name) {
  const nl = canonicalName(name);
  let doc = await City.findOne({ stateID: stateId, nameLower: nl, isDeleted: { $ne: true } }).collation(DEFAULT_COLLATION).exec();
  if (doc) return doc;
  doc = await City.findOne({
    stateID: stateId,
    name: { $regex: `^${escapeRegex(displayNameNormalized(name))}$`, $options: "i" },
    isDeleted: { $ne: true },
  }).exec();
  if (doc) return doc;
  // fallback: match nameLower anywhere and ensure stateIDs match as string
  doc = await City.findOne({ nameLower: nl, isDeleted: { $ne: true } }).exec();
  if (doc && String(doc.stateID) === String(stateId)) return doc;
  return null;
}
async function createOrGetCity(stateId, name, zipCode) {
  const display = displayNameNormalized(name);
  const nl = canonicalName(name);

  let existing = await tryFindCity(stateId, name);
  if (existing){
    // 🔥 zipCodes update if provided
    if (zipCode) {
      await City.updateOne(
        { _id: existing._id },
        { $addToSet: { zipCodes: zipCode } }
      );
    }
    return existing;
  } 

  try {
    const doc = await City.findOneAndUpdate(
      { stateID: stateId, nameLower: nl, isDeleted: { $ne: true } },
      { $setOnInsert: { name: display, nameLower: nl, stateID: stateId,zipCodes: zipCode ? [zipCode] : [], } },
      { upsert: true, new: true, setDefaultsOnInsert: true, collation: DEFAULT_COLLATION }
    ).exec();
    if (doc) return doc;
  } catch (err) {
    if (err && err.code === 11000) {
      console.warn("[register] City upsert E11000:", err.keyValue || err);
      if (err.keyValue) {
        const kv = err.keyValue;
        if (kv.stateID && kv.nameLower) {
          const found = await City.findOne({ stateID: kv.stateID, nameLower: kv.nameLower, isDeleted: { $ne: true } }).exec();
          if (found) return found;
        }
      }
      const fallback = await tryFindCity(stateId, name);
      if (fallback) return fallback;
    }
    throw err;
  }
  throw new Error("City find/create failed");
}

/* -------- Duplicate key parser -------- */
function parseDuplicateKeyError(err) {
  if (!err || !err.code) return null;
  if (err.code !== 11000) return null;

  // prefer readable keyValue if present
  const kv = err.keyValue || {};
  const kp = err.keyPattern || {};
  // email duplication
  if (kv.emailID || kv.email || kp.emailID || kp.email) return { field: "email", message: "Email is already registered." };

  const keys = Object.keys(kp).map(k => k.toLowerCase()).join("|");

  if (keys.includes("countryid") && keys.includes("namelower")) return { field: "state", message: "State already exists for the selected country." };
  if (keys.includes("stateid") && keys.includes("namelower")) return { field: "city", message: "City already exists for the selected state." };
  if (keys.includes("namelower") && !keys.includes("countryid") && !keys.includes("stateid")) return { field: "country", message: "Country already exists." };

  // fallback
  return { field: null, message: "Duplicate record exists." };
}

/* -------- Main registration service -------- */

export const registerUserService = async (payload) => {
  console.error("🔥🔥 registerUserService ACTUALLY CALLED 🔥🔥");

  console.debug("[register] payload keys:", Object.keys(payload || {}));
  let {
    FirstName,
    LastName,
    EmailID,
    Password,
    ConfirmPassword,
    Address,
    CountryName,
    StateName,
    CityName,
    ZipCode,
  } = payload || {};

  FirstName = (FirstName || "").trim();
  LastName = (LastName || "").trim();
  EmailID = (EmailID || "").trim();
  Password = (Password || "").trim();
  ConfirmPassword = (ConfirmPassword || "").trim();
  Address = (Address || "").trim();
  CountryName = (CountryName || "").trim();
  StateName = (StateName || "").trim();
  CityName = (CityName || "").trim();
  ZipCode = (ZipCode || "").trim();

  // basic validation
  if (!FirstName) { const e = new Error("First Name is required."); e.statusCode = 400; throw e; }
  if (!LastName)  { const e = new Error("Last Name is required."); e.statusCode = 400; throw e; }
  if (!EmailID)   { const e = new Error("Email ID is required."); e.statusCode = 400; throw e; }
  if (!Password)  { const e = new Error("Password is required."); e.statusCode = 400; throw e; }
  if (Address) {
    if (!CountryName) { const e = new Error("Country Name is required when Address is entered."); e.statusCode = 400; throw e; }
    if (!StateName)   { const e = new Error("State Name is required when Address is entered."); e.statusCode = 400; throw e; }
    if (!CityName)    { const e = new Error("City Name is required when Address is entered."); e.statusCode = 400; throw e; }
  }

  ensureMaxLength("First Name", FirstName, 50);
  ensureMaxLength("Last Name", LastName, 50);
  ensureMaxLength("Email ID", EmailID, 50);
  ensureMaxLength("Password", Password, 18);
  ensureMaxLength("Address", Address, 100);
  ensureMaxLength("Country Name", CountryName, 50);
  ensureMaxLength("State Name", StateName, 50);
  ensureMaxLength("City Name", CityName, 50);
  ensureMaxLength("Zip", ZipCode, 6);


  if (!emailRegex.test(EmailID)) { const e = new Error("Please enter a valid email address."); e.statusCode = 400; throw e; }
  if (!passwordPolicyRegex.test(Password)) {
    const e = new Error("Password must be 8-18 chars, include 1 uppercase, 1 number and 1 special char.");
    e.statusCode = 400; throw e;
  }
  if (ConfirmPassword && ConfirmPassword !== Password) { const e = new Error("Passwords do not match."); e.statusCode = 400; throw e; }

  // case-insensitive email check
  const emailRegexSearch = new RegExp(`^${escapeRegex(EmailID)}$`, "i");
  const existingUser = await User.findOne({ emailID: emailRegexSearch }).lean().exec();
  if (existingUser) { const e = new Error("Email is already registered."); e.statusCode = 409; e.field = "email"; throw e; }
  
  let countryID = null;
  let stateID = null;
  let cityID = null;

  try {
    if (Address && CountryName && StateName && CityName) {
      console.debug("[register] resolving location for:", CountryName, StateName, CityName);
      const countryDoc = await createOrGetCountry(CountryName);
      countryID = countryDoc._id;
      const stateDoc = await createOrGetState(countryID, StateName);
      stateID = stateDoc._id;
      const cityDoc = await createOrGetCity(stateID, CityName, ZipCode);
      cityID = cityDoc._id;
      console.debug("[register] resolved location ids:", { countryID: countryDoc._id, stateID: stateDoc._id, cityID: cityDoc._id });
    }

    // create user
    const hashedPassword = await hashPassword(Password);
    const createObj = {
  // basic info
  firstName: FirstName,
  lastName: LastName,
  emailID: EmailID,
  password: hashedPassword,
  address: Address || null,

  // location names
  countryName: CountryName || null,
  stateName: StateName || null,
  cityName: CityName || null,

  // location IDs (🔥 FIXED)
  countryID: countryID || null,
  stateID: stateID || null,
  cityID: cityID || null,

  // zip
  zipCode: ZipCode || null,

 createdBy: null,
 updatedBy: null,
};

    console.debug("[register] creating user:", createObj);
    const user = await User.create(createObj);
    console.debug("[register] user created id:", user._id);

    // send email best-effort
    try { await sendRegistrationEmail(EmailID, `${FirstName} ${LastName}`.trim()); } catch (emErr) { console.warn("[register] email send failed:", emErr && emErr.message); }

    return { userID: user._id, firstName: user.firstName, lastName: user.lastName, emailID: user.emailID };
  } catch (err) {
    // log full error for debugging including keyValue/pattern when available
    console.error("[register] registration error:", err && (err.message || err));
    if (err && err.keyValue) console.error("[register] err.keyValue:", err.keyValue);
    if (err && err.keyPattern) console.error("[register] err.keyPattern:", err.keyPattern);
    if (err && err.code === 11000) {
      const parsed = parseDuplicateKeyError(err) || { field: null, message: "Duplicate record exists." };
      const e = new Error(parsed.message);
      e.statusCode = 409;
      e.field = parsed.field || null;
      throw e;
    }
    if (err && err.statusCode) throw err;
    throw err;
  }
};
