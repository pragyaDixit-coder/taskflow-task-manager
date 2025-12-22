// src/controllers/forgotPassword.controller.js
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { User } from "../models/User.js";
import { sendResetPasswordEmail } from "../services/email.service.js";

console.log("🔔 [forgotPassword.controller] MODULE LOADED - pid:", process.pid);
console.log("🔧 NODE_ENV =", process.env.NODE_ENV);

const DEFAULT_FRONTEND_ORIGIN = "http://localhost:5173";
const RESET_PASSWORD_EXP_MINUTES = Number(
  process.env.RESET_PASSWORD_EXP_MINUTES || "10"
);
const RESET_LINK_EXPIRY_MS = RESET_PASSWORD_EXP_MINUTES * 60 * 1000;

function escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/* -------------------------------------------------------------------------- */
/*                          SEND RESET PASSWORD CODE                           */
/* -------------------------------------------------------------------------- */
export const sendResetPasswordCode = async (req, res) => {
  try {
    console.log("📩 [SendResetPasswordCode] BODY:", req.body);

    const email = (req.body.EmailID || "").trim().toLowerCase();
    if (!email) {
      return res
        .status(400)
        .json({ message: "EmailID is required to reset password." });
    }

    const user = await User.findOne({ emailID: email });

    // Security: same response for existing / non-existing email
    if (!user) {
      console.log("⚠️ Reset requested for non-existing email:", email);
      return res.status(400).json({
        message: "This email is not registered with us.",
      });
    }

    // 🔑 Generate reset code
    const resetCode =
      crypto.randomUUID?.() || crypto.randomBytes(32).toString("hex");

    user.resetPasswordCode = resetCode;
    user.resetPasswordCodeValidUpto = new Date(
      Date.now() + RESET_LINK_EXPIRY_MS
    );
    await user.save();

    console.log("🔑 Reset code saved for:", email);

    // ✅ IMPORTANT FIX: prefer resetPageBaseUrl from body
    const baseUrl =
      req.body.resetPageBaseUrl ||
      process.env.FRONTEND_ORIGIN ||
      DEFAULT_FRONTEND_ORIGIN;

    const resetLink = `${baseUrl}/${encodeURIComponent(resetCode)}`;
    console.log("🔗 Reset link generated:", resetLink);

    // 📧 Send email
    await sendResetPasswordEmail(user.emailID, resetLink);

    console.log("✅ Reset password email SENT (check Ethereal preview)");

    return res.json({
      message: "Reset password link has been sent to your email.",
    });
  } catch (err) {
    console.error("❌ sendResetPasswordCode ERROR:", err);
    return res.status(500).json({ message: "Internal server error." });
  }
};

/* -------------------------------------------------------------------------- */
/*                            VALIDATE RESET CODE                              */
/* -------------------------------------------------------------------------- */
export const validateResetPasswordCode = async (req, res) => {
  try {
    const code = (req.query.code || req.body.resetPasswordCode || "")
      .toString()
      .trim();

    console.log("🔎 Validate incoming code:", code);

    if (!code)
      return res
        .status(400)
        .json({ message: "ResetPasswordCode is required." });

    let user = await User.findOne({ resetPasswordCode: code });

    if (!user) {
      const regex = new RegExp("^\\s*" + escapeRegExp(code) + "\\s*$", "i");
      user = await User.findOne({ resetPasswordCode: { $regex: regex } });
    }

    if (!user) return res.status(400).json({ message: "Invalid reset code." });

    if (
      !user.resetPasswordCodeValidUpto ||
      user.resetPasswordCodeValidUpto < new Date()
    ) {
      return res.status(400).json({ message: "Reset code has expired." });
    }

    console.log("✅ Reset code VALID for:", user.emailID);
    return res.json({ message: "OK" });
  } catch (err) {
    console.error("❌ validateResetPasswordCode ERROR:", err);
    return res.status(500).json({ message: "Internal server error." });
  }
};

/* -------------------------------------------------------------------------- */
/*                              RESET PASSWORD                                 */
/* -------------------------------------------------------------------------- */
export const resetPassword = async (req, res) => {
  try {
    const incomingCode = (req.body.resetPasswordCode || req.query.code || "")
      .toString()
      .trim();

    const password = req.body.password;

    console.log("📝 Reset attempt with code:", incomingCode);

    if (!incomingCode || !password) {
      return res.status(400).json({
        message: "ResetPasswordCode and new password are required.",
      });
    }

    let user = await User.findOne({ resetPasswordCode: incomingCode });

    if (!user) {
      const regex = new RegExp(
        "^\\s*" + escapeRegExp(incomingCode) + "\\s*$",
        "i"
      );
      user = await User.findOne({ resetPasswordCode: { $regex: regex } });
    }

    if (!user) return res.status(400).json({ message: "Invalid reset code." });

    if (
      !user.resetPasswordCodeValidUpto ||
      user.resetPasswordCodeValidUpto < new Date()
    ) {
      return res.status(400).json({ message: "Reset code has expired." });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);

    user.resetPasswordCode = null;
    user.resetPasswordCodeValidUpto = null;
    await user.save();

    console.log("✅ Password reset SUCCESS for:", user.emailID);

    return res.json({ message: "Password reset successful." });
  } catch (err) {
    console.error("❌ resetPassword ERROR:", err);
    return res.status(500).json({ message: "Internal server error." });
  }
};
