// src/seedAdminUser.js
import dotenv from "dotenv";
dotenv.config();

import { connectDB } from "./config/db.js";
import { User } from "./models/User.js";
import { hashPassword } from "./utils/password.js";

const seedAdminUser = async () => {
  try {
    await connectDB();

    const emailID = process.env.SEED_ADMIN_EMAIL || "admin@tm.com";
    const plainPassword = process.env.SEED_ADMIN_PASSWORD || "Admin@123";

    const hashed = await hashPassword(plainPassword);

    const update = {
      $set: {
        firstName: "Admin",
        lastName: "User",
        emailID,                // adjust to `email` if your model uses that
        password: hashed,
        address: "Default Address",
        zipCode: "000000",      // adjust to `zip` if your model uses that
        role: "admin",
        isDeleted: false,
        updatedOn: new Date(),
      },
      $setOnInsert: {
        createdOn: new Date(), // use the field your schema expects (createdOn / createdAt)
        createdBy: null,
      },
    };

    const opts = {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    };

    const user = await User.findOneAndUpdate({ emailID }, update, opts).lean();

    console.log("✅ Admin user created/updated (dev output)");
    console.log("Email:", emailID);
    console.log("Password (dev):", plainPassword);
    console.log("UserID:", user?._id?.toString?.() ?? user?._id);

    // optional: close DB connection cleanly
    if (typeof process?.exit === "function") {
      // if connectDB opened a mongoose connection, close it first:
      try {
        const mongoose = (await import("mongoose")).default;
        if (mongoose?.connection?.readyState) {
          await mongoose.disconnect();
        }
      } catch (e) {
        // ignore disconnect errors
      }
      process.exit(0);
    }
  } catch (err) {
    console.error("Error seeding admin user:", err);
    process.exit(1);
  }
};

seedAdminUser();
