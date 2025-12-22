// src/services/email.service.js
// Email service: ab real (Ethereal) email bhejega instead of stub console logs.
// Ye dev/testing ke liye perfect hai. Production me tum Azure/SendGrid wagaira laga sakti ho.

import nodemailer from "nodemailer";

/**
 * Internal helper: Ethereal transporter banata hai.
 * Har run pe test account create hoga (sirf dev ke liye).
 */
async function createTestTransporter() {
  const testAccount = await nodemailer.createTestAccount();

  const transporter = nodemailer.createTransport({
    host: "smtp.ethereal.email",
    port: 587,
    secure: false,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  });

  return { transporter, testAccount };
}

/**
 * Forgot password email
 */
export const sendResetPasswordEmail = async (toEmail, resetLink) => {
  try {
    const { transporter } = await createTestTransporter();

    const info = await transporter.sendMail({
      from: '"Task Manager" <no-reply@taskmanager.com>',
      to: toEmail,
      subject: "Reset your Task Manager password",
      html: `
        <p>Hi,</p>
        <p>You requested to reset your password.</p>
        <p>
          Click the link below to reset your password. If you did not request this,
          please ignore this email.
        </p>
        <p>
          <a href="${resetLink}" target="_blank">Reset Password</a>
        </p>
      `,
    });

    console.log("✅ Reset password email sent (Ethereal)");
    console.log("📧 To:", toEmail);
    console.log("🔗 Preview URL:", nodemailer.getTestMessageUrl(info));
    return true;
  } catch (err) {
    console.error("❌ Error sending reset password email:", err);
    return false;
  }
};

/**
 * Registration email
 */
export const sendRegistrationEmail = async (toEmail, fullName) => {
  try {
    const { transporter } = await createTestTransporter();

    const info = await transporter.sendMail({
      from: '"Task Manager" <no-reply@taskmanager.com>',
      to: toEmail,
      subject: "Welcome to Task Manager",
      html: `
        <p>Hi ${fullName},</p>
        <p>Welcome! Your registration in Task Manager was successful.</p>
        <p>You can now log in and start managing your tasks.</p>
      `,
    });

    console.log("✅ Registration email sent (Ethereal)");
    console.log("📧 To:", toEmail);
    console.log("🔗 Preview URL:", nodemailer.getTestMessageUrl(info));
    return true;
  } catch (err) {
    console.error("❌ Error sending registration email:", err);
    return false;
  }
};
