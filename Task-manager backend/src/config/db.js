// src/config/db.js

import mongoose from "mongoose";

// Ye function MongoDB se connect karega
// Hinglish: app start hote hi ek baar call hoga.
export const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB connected successfully");
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error.message);
    process.exit(1); // app ko band kar do agar DB nahi mila
  }
};
