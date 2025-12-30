// src/services/userManagement.service.js
// Hinglish: Ye file admin/user list wale sab operations handle karegi
// (GetList, GetModel, Insert, Update, Delete, CheckDuplicateEmailID)
// Improvements applied: atomic upserts for locations, index ensure, robust duplicate handling

import { User } from "../models/User.js";
import { Country } from "../models/Country.js";
import { State } from "../models/State.js";
import { City } from "../models/City.js";
import Task from "../models/task.model.js"; // adjust path if needed
import { hashPassword } from "../utils/password.js";
import mongoose from "mongoose";

/* -------------------------
   Helpers / Validators
   ------------------------- */

// Email simple validation
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Password policy
const passwordPolicyRegex =
  /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_\-+=[\]{};':"\\|,.<>/?`~]).{8,18}$/;

// length check helper
const ensureMaxLength = (fieldName, value, max) => {
  if (value && value.length > max) {
    const err = new Error(`${fieldName} must be ${max} characters or fewer.`);
    err.statusCode = 400;
    throw err;
  }
};

// canonical lower-case for names (country/state/city)
const canonical = (s) => (s ? String(s).trim().toLowerCase() : "");

// canonical for email
const canonicalEmail = (e) => (e ? String(e).trim().toLowerCase() : "");

/**
 * Normalize zipCodes input: accept string or array and always return array of strings
 * Examples:
 *  - ["400001","400002"] => ["400001","400002"]
 *  - "400001,400002" => ["400001","400002"]
 *  - "400001" => ["400001"]
 *  - undefined/null => []
 */
function normalizeZipCodes(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map((z) => String(z).trim()).filter(Boolean);
  }
  if (typeof raw === "string") {
    return raw
      .split(",")
      .map((z) => String(z).trim())
      .filter(Boolean);
  }
  return [];
}

/* -------------------------
   Index ensures (run at startup)
   ------------------------- */

async function ensureLocationIndexes() {
  try {
    // use nameLower as the canonical unique key, but also keep options relaxed for collation
    await Country.collection.createIndex(
      { nameLower: 1 },
      { unique: true, background: true }
    );
  } catch (e) {
    // ignore if index exists or other harmless errors
  }

  try {
    await State.collection.createIndex(
      { countryID: 1, nameLower: 1 },
      { unique: true, background: true }
    );
  } catch (e) {
    // ignore
  }

  try {
    await City.collection.createIndex(
      { stateID: 1, nameLower: 1 },
      { unique: true, background: true }
    );
  } catch (e) {
    // ignore
  }
}

// Fire and forget index ensures (non-blocking)
ensureLocationIndexes().catch(() => {});

/* -------------------------
   Location helpers (atomic upsert)
   ------------------------- */

/**
 * findOrCreateCountry: atomic findOneAndUpdate with upsert and $setOnInsert
 */
async function findOrCreateCountry(name, currentUserId = null) {
  const nameTrim = (name || "").trim();
  const nameLower = canonical(nameTrim);
  if (!nameTrim) return null;

  // 1️⃣ First try to find (case-insensitive)
  let country = await Country.findOne({ nameLower }).exec();

  if (country) {
    if (country.name !== nameTrim) {
      country.name = nameTrim;
      country.updatedBy = currentUserId;
      await country.save().catch(() => {});
    }
    return country;
  }

  // 2️⃣ Try to create (protected)
  try {
    country = new Country({
      name: nameTrim,
      nameLower,
      createdBy: currentUserId,
      isDeleted: false,
      createdOn: new Date(),
    });

    await country.save();
    return country;
  } catch (err) {
    // 3️⃣ Duplicate key → retry find
    if (err && err.code === 11000) {
      const retry = await Country.findOne({ nameLower }).exec();
      if (retry) return retry;
    }
    throw err;
  }
}


/**
 * findOrCreateState: atomic upsert per (countryId + nameLower)
 */
async function findOrCreateState(
  countryId,
  stateName,
  currentUserId = null
) {
  const nameTrim = (stateName || "").trim();
  const nameLower = canonical(nameTrim);
  if (!nameTrim) return null;

  const countryObjectId =
    countryId && mongoose.Types.ObjectId.isValid(String(countryId))
      ? new mongoose.Types.ObjectId(String(countryId))
      : countryId;

  // 1️⃣ Try to find existing state
  let state = await State.findOne({
    countryID: countryObjectId,
    nameLower,
    isDeleted: false,
  }).exec();

  if (state) {
    // ✅ UPDATE CASE
    if (state.name !== nameTrim) {
      state.name = nameTrim;
    }

    state.updatedBy = currentUserId;
    await state.save();
    return state;
  }

  // 2️⃣ CREATE CASE
  state = new State({
    name: nameTrim,
    nameLower,
    countryID: countryObjectId,
    createdBy: currentUserId,
    isDeleted: false,
    createdOn: new Date(),
  });

  await state.save();
  return state;
}


/**
 * findOrCreateCity: atomic upsert per (stateId + nameLower)
 * Accepts optional zipArray (string[]). If provided:
 *  - On insert: set zipCodes to zipArray
 *  - If city existed and zipArray non-empty: update zipCodes to the incoming array
 */
async function findOrCreateCity(
  stateId,
  cityName,
  currentUserId = null,
  zipArray = []
) {
  const nameTrim = (cityName || "").trim();
  const nameLower = canonical(nameTrim);
  if (!nameTrim) return null;

  const stateObjectId =
    stateId && mongoose.Types.ObjectId.isValid(String(stateId))
      ? new mongoose.Types.ObjectId(String(stateId))
      : stateId;

  const zClean = Array.isArray(zipArray)
    ? zipArray.map((z) => String(z).trim()).filter(Boolean)
    : [];

  // 1️⃣ Try to find existing city
  let city = await City.findOne({
    stateID: stateObjectId,
    nameLower,
    isDeleted: false,
  }).exec();

  if (city) {
    // ✅ UPDATE CASE
    if (zClean.length > 0) {
      city.zipCodes = zClean;
    }

    if (city.name !== nameTrim) {
      city.name = nameTrim;
    }

    city.updatedBy = currentUserId;
    await city.save();
    return city;
  }

  // 2️⃣ CREATE CASE
  city = new City({
    name: nameTrim,
    nameLower,
    stateID: stateObjectId,
    zipCodes: zClean,
    createdBy: currentUserId,
    isDeleted: false,
    createdOn: new Date(),
  });

  await city.save();
  return city;
}


/**
 * upsertLocation: orchestrates country/state/city creation if needed.
 * Returns city._id or null.
 * Accepts zipArray (string[]) — forwards to findOrCreateCity so zipCodes persisted.
 */
const upsertLocation = async (currentUserId, CountryName, StateName, CityName, zipArray = []) => {
  if (!CountryName || !StateName || !CityName) return null;

  try {
    const countryDoc = await findOrCreateCountry(CountryName, currentUserId);
    if (!countryDoc) return null;

    const stateDoc = await findOrCreateState(countryDoc._id, StateName, currentUserId);
    if (!stateDoc) return null;

    const cityDoc = await findOrCreateCity(stateDoc._id, CityName, currentUserId, zipArray);
    if (!cityDoc) return null;

    return cityDoc._id;
  } catch (err) {
    const e = new Error(`Location upsert failed: ${err.message || err}`);
    e.statusCode = err.statusCode || 500;
    throw e;
  }
};

/* -------------------------
   Location resolve helper
   ------------------------- */
const resolveLocation = async (user) => {
  try {
    if (!user || !user.cityID) {
      return { countryName: "", stateName: "", cityName: "" };
    }

    const city = await City.findById(user.cityID).lean().exec();
    if (!city) return { countryName: "", stateName: "", cityName: "" };

    const state = await State.findById(city.stateID).lean().exec();
    if (!state) {
      return { countryName: "", stateName: "", cityName: city.name || "" };
    }

    const country = await Country.findById(state.countryID).lean().exec();

    return {
      countryName: country?.name || "",
      stateName: state?.name || "",
      cityName: city?.name || "",
    };
  } catch (err) {
    return { countryName: "", stateName: "", cityName: "" };
  }
};

/* -------------------------
   Utility helpers
   ------------------------- */

function escapeRegex(text) {
  // escape regex special characters for safe case-insensitive matching fallback
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isAdminUser(currentUser) {
  if (!currentUser) return false;

  // authMiddleware ne already isAdmin flag set kiya hoga
  if (currentUser.isAdmin === true) return true;

  const maybeRole =
    currentUser.role ??
    (Array.isArray(currentUser.roles) ? currentUser.roles[0] : currentUser.roles) ??
    "";

  if (typeof maybeRole === "string" && maybeRole.trim()) {
    return maybeRole.trim().toLowerCase() === "admin";
  }

  if (Array.isArray(currentUser.roles)) {
    return currentUser.roles
      .map((x) => String(x).toLowerCase())
      .includes("admin");
  }

  if (currentUser.is_superuser === true) return true;
  return false;
}

/**
 * Robust server-side task-to-user detection
 */
async function userHasAssignedTasks(userId) {
  if (!userId) return false;
  const idStr = String(userId);

  // Query candidate tasks which contain likely assignment fields
  const candidates = await Task.find({
    $or: [
      { assignedToIds: { $exists: true } },
      { assignedTo: { $exists: true } },
      { AssignedTo: { $exists: true } },
      { TaskAssignedUser: { $exists: true } },
      { TaskAssignedUsers: { $exists: true } },
      { AssignedUserId: { $exists: true } },
      { assignedUserId: { $exists: true } },
      { AssignedUser: { $exists: true } },
      { assignedUser: { $exists: true } },
    ],
  })
    .lean()
    .exec();

  if (!Array.isArray(candidates) || candidates.length === 0) return false;

  const taskBelongsToUser = (task, mongoId) => {
    if (!task) return false;
    const idS = String(mongoId);

    const assignedToIds =
      task.assignedToIds ?? task.AssignedToIds ?? task.AssignedToId ?? task.AssignedToIDs ?? null;
    if (Array.isArray(assignedToIds)) {
      for (const v of assignedToIds) if (String(v) === idS) return true;
    }

    const assignedTo = task.assignedTo ?? task.AssignedTo ?? null;
    if (Array.isArray(assignedTo)) {
      for (const v of assignedTo) if (String(v) === idS) return true;
    }

    const taskAssigned =
      task.TaskAssignedUser ?? task.TaskAssignedUsers ?? task.AssignedUsers ?? null;
    if (Array.isArray(taskAssigned)) {
      for (const obj of taskAssigned) {
        const candidate =
          obj?.AssignedUserID ?? obj?.assignedUserId ?? obj?.id ?? obj?._id ?? null;
        if (candidate != null && String(candidate) === idS) return true;
      }
    }

    const singleAssigned =
      task.AssignedTo ?? task.assignedTo ?? task.Assigned ?? null;
    if (singleAssigned != null) {
      if (typeof singleAssigned === "string") {
        if (singleAssigned === idS) return true;
        try {
          const parsed = JSON.parse(singleAssigned);
          if (Array.isArray(parsed)) {
            if (parsed.some((v) => String(v) === idS)) return true;
          } else if (String(parsed) === idS) return true;
        } catch {
          // ignore parse errors
        }
      } else if (String(singleAssigned) === idS) return true;
    }

    const otherCandidate =
      task.AssignedUserId ?? task.assignedUserId ?? task.AssignedUser ?? task.assignedUser ?? null;
    if (otherCandidate != null && String(otherCandidate) === idS) return true;

    return false;
  };

  for (const t of candidates) {
    if (taskBelongsToUser(t, idStr)) return true;
  }

  return false;
}

/* -------------------------
   Services
   ------------------------- */

/**
 * 1) GetList (optionalId, currentUser)
 *    - Admin: sab users (optionalId filter)
 *    - Normal user: sirf un users ko jo usne create kiye (createdBy = currentUser.id)
 */
export const getUserListService = async (optionalId, currentUser = null) => {
  if (!currentUser) {
    return [];
  }

  const admin = isAdminUser(currentUser);
  const filter = { isDeleted: { $ne: true } };

  if (optionalId) filter._id = optionalId;
  if (!admin) {
    const curIdStr = String(currentUser._id || currentUser.id);
    const idValue = mongoose.Types.ObjectId.isValid(curIdStr)
      ? new mongoose.Types.ObjectId(curIdStr)
      : curIdStr;

    // 🔥 FIX: self + created users
    filter.$or = [
      { _id: idValue },        // 👈 login user khud
      { createdBy: idValue }, // 👈 uske banaye hue users
    ];
  }
  

  const users = await User.find(filter)
    .populate("createdBy", "firstName lastName")
    .populate("updatedBy", "firstName lastName")
    .sort({ createdOn: -1 })
    .exec();

  const out = [];
  for (const u of users) {
    const loc = await resolveLocation(u);
    out.push({
      userID: String(u._id),
      firstName: u.firstName || "",
      lastName: u.lastName || "",
      emailID: u.emailID || "",
      address: u.address || "",
      countryName: loc.countryName,
      stateName: loc.stateName,
      cityName: loc.cityName,
      zipCode: u.zipCode || "",
      avatarUrl: u.avatarUrl || null,
      createdOn: u.createdOn ? u.createdOn.toISOString() : null,
      createdByUserName: u.createdBy
        ? `${u.createdBy.firstName} ${u.createdBy.lastName}`.trim()
        : "",
      createdById: u.createdBy ? String(u.createdBy._id ?? u.createdBy) : null,
      updatedOn: u.updatedOn ? u.updatedOn.toISOString() : null,
      updatedByUserName: u.updatedBy
        ? `${u.updatedBy.firstName} ${u.updatedBy.lastName}`.trim()
        : "",
      updatedById: u.updatedBy ? String(u.updatedBy._id ?? u.updatedBy) : null,
    });
  }

  return out;
};

/**
 * 2) GetModel (id, currentUser)
 *    - Admin: kisi ka bhi model dekh sakta hai
 *    - Normal user: sirf:
 *         - khud ka record (self)
 *         - ya jo record usne create kiya ho (createdBy = currentUser.id)
 */
export const getUserModelService = async (id, currentUser = null) => {
  if (!id) {
    const err = new Error("User id is required.");
    err.statusCode = 400;
    throw err;
  }

  if (!currentUser) {
    const err = new Error("Unauthorized");
    err.statusCode = 401;
    throw err;
  }

  const user = await User.findById(id)
    .populate("createdBy", "firstName lastName")
    .populate("updatedBy", "firstName lastName")
    .exec();

  if (!user || user.isDeleted) {
    const err = new Error("User not found");
    err.statusCode = 404;
    throw err;
  }

  const admin = isAdminUser(currentUser);
  const currentIdStr = String(currentUser.id);
  const createdByStr = user.createdBy
    ? String(user.createdBy._id ?? user.createdBy)
    : null;
  const isSelf = String(user._id) === currentIdStr;

  if (!admin && !isSelf && (!createdByStr || createdByStr !== currentIdStr)) {
    const err = new Error("Forbidden");
    err.statusCode = 403;
    throw err;
  }

  const loc = await resolveLocation(user);

  return {
    userID: user._id,
    firstName: user.firstName,
    lastName: user.lastName,
    emailID: user.emailID,
    address: user.address || "",
    countryName: loc.countryName,
    stateName: loc.stateName,
    cityName: loc.cityName,
    zipCode: user.zipCode || "",
    avatarUrl: user.avatarUrl || null,
    createdOn: user.createdOn,
    createdByUserName: user.createdBy
      ? `${user.createdBy.firstName} ${user.createdBy.lastName}`.trim()
      : "",
    createdById: user.createdBy
      ? String(user.createdBy._id ?? user.createdBy)
      : null,
    updatedOn: user.updatedOn,
    updatedByUserName: user.updatedBy
      ? `${user.updatedBy.firstName} ${user.updatedBy.lastName}`.trim()
      : "",
    updatedById: user.updatedBy
      ? String(user.updatedBy._id ?? user.updatedBy)
      : null,
  };
};

/**
 * 3) GetLookupList
 *    - Admin: sab active users
 *    - Normal user: khud + jo users usne create kiye (createdBy = currentUser.id)
 */
export const getUserLookupListService = async (currentUser = null) => {
  const admin = isAdminUser(currentUser);
  const filter = { isDeleted: { $ne: true } };

  if (!admin && currentUser) {
    const curIdStr = String(currentUser._id || currentUser.id);
    const idValue = mongoose.Types.ObjectId.isValid(curIdStr)
      ? new mongoose.Types.ObjectId(curIdStr)
      : curIdStr;

    // normal user ke liye: khud + uske banaye hue users
    filter.$or = [{ _id: idValue }, { createdBy: idValue }];
  }

  const users = await User.find(filter)
    .sort({ firstName: 1, lastName: 1 })
    .lean()
    .exec();

  return users.map((u) => ({
    userID: u._id,
    userName: `${u.firstName} ${u.lastName}`.trim(),
  }));
};

/**
 * 4) Insert user
 *    - createdBy = currentUserId
 *    - role field DB default se "User" ban jayega (User model me default set hai)
 */

export const insertUserService = async (payload, currentUserId) => {
  let {
    FirstName,
    LastName,
    EmailID,
    Password,
    Address,
    CountryName,
    StateName,
    CityName,
    Zip,
    AvatarUrl,
  } = payload || {};

  FirstName = (FirstName || "").trim();
  LastName = (LastName || "").trim();
  EmailID = canonicalEmail(EmailID);
  Password = (Password || "").trim();
  Address = (Address || "").trim();
  CountryName = (CountryName || "").trim();
  StateName = (StateName || "").trim();
  CityName = (CityName || "").trim();
  Zip = (Zip || "").trim();

  // Normalize zipArray - accept payload.zipCodes (array or comma string) or Zip
  const incomingZipRaw = payload?.zipCodes ?? Zip ?? "";
  const zipArray = normalizeZipCodes(incomingZipRaw);

  if (!FirstName) {
    const err = new Error("First Name is required.");
    err.statusCode = 400;
    throw err;
  }
  if (!LastName) {
    const err = new Error("Last Name is required.");
    err.statusCode = 400;
    throw err;
  }
  if (!EmailID) {
    const err = new Error("Email ID is required.");
    err.statusCode = 400;
    throw err;
  }
  if (!Password) {
    const err = new Error("Password is required.");
    err.statusCode = 400;
    throw err;
  }

  ensureMaxLength("First Name", FirstName, 50);
  ensureMaxLength("Last Name", LastName, 50);
  ensureMaxLength("Email ID", EmailID, 50);
  ensureMaxLength("Password", Password, 18);
  ensureMaxLength("Address", Address, 100);
  ensureMaxLength("Country Name", CountryName, 50);
  ensureMaxLength("State Name", StateName, 50);
  ensureMaxLength("City Name", CityName, 50);
  ensureMaxLength("Zip", Zip, 6);

  if (Address) {
    if (!CountryName) {
      const err = new Error(
        "Country Name is required when Address is entered."
      );
      err.statusCode = 400;
      throw err;
    }
    if (!StateName) {
      const err = new Error(
        "State Name is required when Address is entered."
      );
      err.statusCode = 400;
      throw err;
    }
    if (!CityName) {
      const err = new Error(
        "City Name is required when Address is entered."
      );
      err.statusCode = 400;
      throw err;
    }
  }

  if (!emailRegex.test(EmailID)) {
    const err = new Error("Please enter a valid email address.");
    err.statusCode = 400;
    throw err;
  }

  if (!passwordPolicyRegex.test(Password)) {
    const err = new Error(
      "Password must be 8-18 chars, include 1 uppercase, 1 number and 1 special char."
    );
    err.statusCode = 400;
    throw err;
  }

  const existing = await User.findOne({
    emailID: EmailID,
    isDeleted: { $ne: true },
  }).exec();
  if (existing) {
    const err = new Error("Email is already registered.");
    err.statusCode = 409;
    throw err;
  }

  // Pass zipArray into upsertLocation so City.zipCodes gets set/updated
  const cityID = Address
    ? await upsertLocation(currentUserId, CountryName, StateName, CityName, zipArray)
    : null;
  let countryID = null;
let stateID = null;

if (cityID) {
  const cityDoc = await City.findById(cityID).lean();
  if (cityDoc?.stateID) {
    stateID = cityDoc.stateID;

    const stateDoc = await State.findById(stateID).lean();
    if (stateDoc?.countryID) {
      countryID = stateDoc.countryID;
    }
  }
}

  const hashed = await hashPassword(Password);

  const newUser = await User.create({
    firstName: FirstName,
    lastName: LastName,
    emailID: EmailID,
    password: hashed,
    address: Address || null,
    // 🔥 LOCATION IDS (FIX)
    countryID: countryID,
    stateID: stateID,
    cityID: cityID || null,
    zipCode: Zip || null,
    zipCodes: Array.isArray(zipArray) && zipArray.length > 0 ? zipArray : [],
    isDeleted: false,
    createdBy: currentUserId || null,
    updatedBy: currentUserId || null,
    avatarUrl: AvatarUrl || null,
    // role: not set here → User model default ("User") apply hoga
  });

 
  return { userID: newUser._id };
};

/**
 * 5) Update user
 */
export const updateUserService = async (payload, currentUserId) => {
  let {
    UserID,
    FirstName,
    LastName,
    EmailID,
    Password,
    Address,
    CountryName,
    StateName,
    CityName,
    Zip,
    UpdatePassword,
    AvatarUrl,
  } = payload || {};

  if (!UserID) {
    const err = new Error("UserID is required.");
    err.statusCode = 400;
    throw err;
  }

  FirstName = (FirstName || "").trim();
  LastName = (LastName || "").trim();
  EmailID = canonicalEmail(EmailID);
  Password = (Password || "").trim();
  Address = (Address || "").trim();
  CountryName = (CountryName || "").trim();
  StateName = (StateName || "").trim();
  CityName = (CityName || "").trim();
  Zip = (Zip || "").trim();

  const updatePasswordFlag = Boolean(UpdatePassword);

  // Normalize zip array (payload.zipCodes preferred)
  const incomingZipRaw = payload?.zipCodes ?? Zip ?? "";
  const zipArray = normalizeZipCodes(incomingZipRaw);

  if (!FirstName) {
    const err = new Error("First Name is required.");
    err.statusCode = 400;
    throw err;
  }
  if (!LastName) {
    const err = new Error("Last Name is required.");
    err.statusCode = 400;
    throw err;
  }
  if (!EmailID) {
    const err = new Error("Email ID is required.");
    err.statusCode = 400;
    throw err;
  }

  ensureMaxLength("First Name", FirstName, 50);
  ensureMaxLength("Last Name", LastName, 50);
  ensureMaxLength("Email ID", EmailID, 50);
  if (Password) ensureMaxLength("Password", Password, 18);
  ensureMaxLength("Address", Address, 100);
  ensureMaxLength("Country Name", CountryName, 50);
  ensureMaxLength("State Name", StateName, 50);
  ensureMaxLength("City Name", CityName, 50);
  ensureMaxLength("Zip", Zip, 6);

  if (Address) {
    if (!CountryName) {
      const err = new Error(
        "Country Name is required when Address is entered."
      );
      err.statusCode = 400;
      throw err;
    }
    if (!StateName) {
      const err = new Error(
        "State Name is required when Address is entered."
      );
      err.statusCode = 400;
      throw err;
    }
    if (!CityName) {
      const err = new Error(
        "City Name is required when Address is entered."
      );
      err.statusCode = 400;
      throw err;
    }
  }

  if (!emailRegex.test(EmailID)) {
    const err = new Error("Please enter a valid email address.");
    err.statusCode = 400;
    throw err;
  }

  if (updatePasswordFlag) {
    if (!Password) {
      const err = new Error(
        "Password is required when UpdatePassword is true."
      );
      err.statusCode = 400;
      throw err;
    }
    if (!passwordPolicyRegex.test(Password)) {
      const err = new Error(
        "Password must be at least 8 characters, including one uppercase letter, one number, and one special character."
      );
      err.statusCode = 400;
      throw err;
    }
  }

  const duplicate = await User.findOne({
    emailID: EmailID,
    _id: { $ne: UserID },
    isDeleted: { $ne: true },
  }).exec();
  if (duplicate) {
    const err = new Error("Email is already registered.");
    err.statusCode = 409;
    throw err;
  }

  const user = await User.findById(UserID).exec();
  if (!user || user.isDeleted) {
    const err = new Error("User not found");
    err.statusCode = 404;
    throw err;
  }

  // upsert location - now accepts zipArray (so City.zipCodes will be set/updated if provided)
  const cityID = Address
    ? await upsertLocation(currentUserId, CountryName, StateName, CityName, zipArray)
    : null;

    let countryID = null;
let stateID = null;

if (cityID) {
  const cityDoc = await City.findById(cityID).lean();
  if (cityDoc?.stateID) {
    stateID = cityDoc.stateID;

    const stateDoc = await State.findById(stateID).lean();
    if (stateDoc?.countryID) {
      countryID = stateDoc.countryID;
    }
  }
}


  user.firstName = FirstName;
  user.lastName = LastName;
  user.emailID = EmailID;
  user.address = Address || null;
    // 🔥 LOCATION IDS (FIX)
  user.countryID = countryID || null;
  user.stateID = stateID || null;
  user.cityID = cityID || null;
  user.zipCode = Zip || null;
  // Set user's zipCodes array too (keeps user document in sync)
  user.zipCodes = Array.isArray(zipArray) && zipArray.length > 0 ? zipArray : (user.zipCodes || []);
  user.updatedBy = currentUserId || null;

  if (AvatarUrl !== undefined) user.avatarUrl = AvatarUrl || null;

  if (updatePasswordFlag) {
    const hashed = await hashPassword(Password);
    user.password = hashed;
  }

  await user.save();

  return { updatedOn: user.updatedOn };
};

/**
 * 6) Delete user (permanent delete guarded by assigned-tasks check)
 *    NOTE: yahan authorization controller level pe handle ho sakta hai
 */
export const deleteUserService = async (id, currentUserId) => {
  if (!id) {
    const err = new Error("User id is required");
    err.statusCode = 400;
    throw err;
  }

  const user = await User.findById(id).exec();
  if (!user || user.isDeleted) {
    const err = new Error("User not found");
    err.statusCode = 404;
    throw err;
  }

  // Check assigned tasks - block permanent delete if any tasks reference this user
  const hasTasks = await userHasAssignedTasks(id);
  if (hasTasks) {
    const err = new Error("User has assigned tasks");
    err.statusCode = 400;
    throw err;
  }

  // No assigned tasks -> perform permanent deletion
  await User.deleteOne({ _id: id }).exec();

  return { message: "User deleted successfully" };
};

/**
 * 7) CheckDuplicateEmailForUserService
 */
export const checkDuplicateEmailForUserService = async (
  EmailID,
  ExcludeID
) => {
  const email = canonicalEmail(EmailID);
  if (!email) {
    const err = new Error("EmailID is required.");
    err.statusCode = 400;
    throw err;
  }

  const filter = { emailID: email, isDeleted: { $ne: true } };
  if (ExcludeID) filter._id = { $ne: ExcludeID };

  const existing = await User.findOne(filter).exec();
  if (existing) {
    const err = new Error("Email is already registered.");
    err.statusCode = 409;
    throw err;
  }

  return { isDuplicate: false };
};
