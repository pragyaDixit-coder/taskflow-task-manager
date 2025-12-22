// src/services/currentUser.service.js
// Current user (profile) business logic

import { User } from "../models/User.js";
import { Country } from "../models/Country.js";
import { State } from "../models/State.js";
import { City } from "../models/City.js";
import { hashPassword } from "../utils/password.js";

/**
 * Helper: resolve City -> State -> Country names and ids for a user
 * Returns:
 *  { countryName, stateName, cityName, countryID, stateID, cityID }
 */
const resolveLocation = async (user) => {
  try {
    if (!user || !user.cityID) {
      return {
        countryName: "",
        stateName: "",
        cityName: "",
        countryID: null,
        stateID: null,
        cityID: null,
      };
    }

    // use lean() for faster read-only docs
    const city = await City.findById(user.cityID).lean().exec();
    if (!city) {
      return {
        countryName: "",
        stateName: "",
        cityName: "",
        countryID: null,
        stateID: null,
        cityID: null,
      };
    }

    const state = city.stateID ? await State.findById(city.stateID).lean().exec() : null;
    const country = state && state.countryID ? await Country.findById(state.countryID).lean().exec() : null;

    return {
      countryName: country?.name || "",
      stateName: state?.name || "",
      cityName: city?.name || "",
      countryID: country?._id ?? null,
      stateID: state?._id ?? null,
      cityID: city?._id ?? null,
    };
  } catch (err) {
    // bubble up - caller will handle/log
    throw err;
  }
};

/* -----------------------
   1) GET current user model
   ----------------------- */
export const getCurrentUserService = async (currentUserId) => {
  if (!currentUserId) {
    const err = new Error("currentUserId is required");
    err.statusCode = 400;
    throw err;
  }

  const user = await User.findById(currentUserId)
    .populate("createdBy", "firstName lastName")
    .populate("updatedBy", "firstName lastName")
    .exec();

  if (!user || user.isDeleted) {
    const err = new Error("User not found");
    err.statusCode = 404;
    throw err;
  }

  const loc = await resolveLocation(user);

  // normalize role: prefer explicit role string, else roles array, else boolean flags
  let roleValue = null;
  if (user.role) {
    roleValue = String(user.role).trim();
  } else if (Array.isArray(user.roles) && user.roles.length) {
    // take first role but keep as string
    roleValue = String(user.roles[0]).trim();
  } else if (user.isAdmin === true || user.is_superuser === true) {
    roleValue = "admin";
  } else {
    roleValue = null;
  }

  // lowercase role for consistency on frontend checks
  const roleNormalized = roleValue ? String(roleValue).toLowerCase() : null;

  // createdBy/updatedBy id extraction (string) to ease client-side checks
  const createdById = user.createdBy ? String(user.createdBy._id ?? user.createdBy) : (user.createdById ? String(user.createdById) : null);
  const updatedById = user.updatedBy ? String(user.updatedBy._id ?? user.updatedBy) : (user.updatedById ? String(user.updatedById) : null);

  return {
    // canonical model shape expected by frontend
    userID: String(user._id),
    firstName: user.firstName || "",
    lastName: user.lastName || "",
    emailID: user.emailID || user.email || "",
    address: user.address || "",
    countryName: loc.countryName || "",
    stateName: loc.stateName || "",
    cityName: loc.cityName || "",
    // Provide IDs too (helps frontend map to selects)
    countryID: loc.countryID ?? null,
    stateID: loc.stateID ?? null,
    cityID: loc.cityID ?? null,
    zipCode: user.zipCode || user.zip || "",
    avatarUrl: user.avatarUrl || null,
    role: roleNormalized, // e.g. "admin" or "user" or null
    roles: Array.isArray(user.roles) ? user.roles : user.role ? [user.role] : [],
    isDeleted: !!user.isDeleted,
    createdOn: user.createdOn,
    createdByUserName: user.createdBy
      ? `${user.createdBy.firstName} ${user.createdBy.lastName}`.trim()
      : "",
    createdById,
    updatedOn: user.updatedOn,
    updatedByUserName: user.updatedBy
      ? `${user.updatedBy.firstName} ${user.updatedBy.lastName}`.trim()
      : "",
    updatedById,
  };
};

/* -----------------------
   2) UPDATE current user
   ----------------------- */
export const updateCurrentUserService = async (currentUserId, payload) => {
  if (!currentUserId) {
    const err = new Error("currentUserId is required");
    err.statusCode = 400;
    throw err;
  }

  if (!payload || typeof payload !== "object") {
    const err = new Error("Invalid payload");
    err.statusCode = 400;
    throw err;
  }

  let {
    FirstName,
    LastName,
    EmailID,
    Address,
    CountryName,
    StateName,
    CityName,
    Zip,
    AvatarUrl,
    UpdatePassword,
    Password,
  } = payload || {};

  FirstName = (FirstName || "").trim();
  LastName = (LastName || "").trim();
  EmailID = (EmailID || "").trim();
  Address = (Address || "").trim();
  CountryName = (CountryName || "").trim();
  StateName = (StateName || "").trim();
  CityName = (CityName || "").trim();
  Zip = (Zip || "").trim();

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

  // If address provided, require Country/State/City
  if (Address) {
    if (!CountryName) {
      const err = new Error("Country Name is required when Address is entered.");
      err.statusCode = 400;
      throw err;
    }
    if (!StateName) {
      const err = new Error("State Name is required when Address is entered.");
      err.statusCode = 400;
      throw err;
    }
    if (!CityName) {
      const err = new Error("City Name is required when Address is entered.");
      err.statusCode = 400;
      throw err;
    }
  }

  // Duplicate email check (exclude current user)
  const duplicate = await User.findOne({
    emailID: EmailID,
    _id: { $ne: currentUserId },
    isDeleted: { $ne: true },
  }).exec();

  if (duplicate) {
    const err = new Error("Email is already registered.");
    err.statusCode = 409;
    throw err;
  }

  // Upsert location (Country -> State -> City) if Address provided
  let cityID = null;
  if (Address && CountryName && StateName && CityName) {
    let country = await Country.findOne({ name: CountryName }).exec();
    if (!country) {
      country = await Country.create({
        name: CountryName,
        createdBy: currentUserId,
      });
    }

    let state = await State.findOne({
      name: StateName,
      countryID: country._id,
    }).exec();
    if (!state) {
      state = await State.create({
        name: StateName,
        countryID: country._id,
        createdBy: currentUserId,
      });
    }

    let city = await City.findOne({
      name: CityName,
      stateID: state._id,
    }).exec();
    if (!city) {
      city = await City.create({
        name: CityName,
        stateID: state._id,
        createdBy: currentUserId,
      });
    }

    cityID = city._id;
  }

  const user = await User.findById(currentUserId).exec();
  if (!user || user.isDeleted) {
    const err = new Error("User not found");
    err.statusCode = 404;
    throw err;
  }

  user.firstName = FirstName;
  user.lastName = LastName;
  user.emailID = EmailID;
  user.address = Address || null;
  user.cityID = cityID || null;
  user.zipCode = Zip || null;
  user.avatarUrl = AvatarUrl !== undefined ? AvatarUrl : user.avatarUrl;
  user.updatedBy = currentUserId;

  // Password update if requested
  if (UpdatePassword) {
    if (!Password) {
      const err = new Error("Password is required when UpdatePassword is true.");
      err.statusCode = 400;
      throw err;
    }
    // Hash the new password before saving
    const hashed = await hashPassword(Password);
    user.password = hashed;
  }

  await user.save();

  // Return refreshed model (re-using getCurrentUserService)
  return await getCurrentUserService(currentUserId);
};

/* -----------------------
   3) Check duplicate email for current user
   ----------------------- */
export const checkDuplicateEmailService = async (currentUserId, emailID) => {
  const EmailID = (emailID || "").trim();
  if (!EmailID) {
    const err = new Error("EmailID is required.");
    err.statusCode = 400;
    throw err;
  }

  const duplicate = await User.findOne({
    emailID: EmailID,
    _id: { $ne: currentUserId },
    isDeleted: { $ne: true },
  }).exec();

  if (duplicate) {
    const err = new Error("Email is already registered.");
    err.statusCode = 409; // Conflict
    throw err;
  }

  return { isDuplicate: false };
};
