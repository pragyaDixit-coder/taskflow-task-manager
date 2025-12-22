// src/models/User.js

import mongoose from "mongoose";

const { Schema } = mongoose;

const userSchema = new Schema(
  {
    // ===============================
    // Basic User Info
    // ===============================
    firstName: {
      type: String,
      required: true,
      maxlength: 50,
      trim: true,
    },

    lastName: {
      type: String,
      required: true,
      maxlength: 50,
      trim: true,
    },

    emailID: {
      type: String,
      required: true,
      unique: true,
      maxlength: 50,
      lowercase: true,
      trim: true,
    },

    // 🔐 Hashed password (bcrypt)
    password: {
      type: String,
      required: true,
      maxlength: 100,
    },

    address: {
      type: String,
      maxlength: 100,
      trim: true,
    },

    // reference to City
    cityID: {
      type: Schema.Types.ObjectId,
      ref: "City",
      default: null,
    },

    // keep single zip code field for backward compatibility
    zipCode: {
      type: String,
      maxlength: 20,
      trim: true,
      default: "",
    },

    // NEW: support multiple zip codes as an array
    zipCodes: {
      type: [String],
      default: [],
    },

    // optional state/country refs (helpful for signup)
    stateID: {
      type: Schema.Types.ObjectId,
      ref: "State",
      default: null,
    },

    countryID: {
      type: Schema.Types.ObjectId,
      ref: "Country",
      default: null,
    },

    avatarUrl: {
      type: String,
      default: null,
    },

    // ===============================
    // Role Management
    // ===============================
    role: {
      type: String,
      enum: ["admin", "User"],
      required: true,
      default: "User",
    },

    // ===============================
    // Forgot / Reset Password
    // ===============================
    // ✅ Reset password link ka unique code
    resetPasswordCode: {
      type: String,
      default: null,
    },

    // ✅ Code kis time tak valid hai
    resetPasswordCodeValidUpto: {
      type: Date,
      default: null,
    },

    // ===============================
    // Audit Fields
    // ===============================
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
  },
  {
    // ✅ createdOn / updatedOn auto generate honge
    timestamps: {
      createdAt: "createdOn",
      updatedAt: "updatedOn",
    },
    collection: "users",
  }
);

// optional: add a small index to help case-insensitive lookups (if you want)
// userSchema.index({ emailID: 1 }, { unique: true });

export const User = mongoose.model("User", userSchema);
