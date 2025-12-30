// src/pages/auth/ForgotPassword.tsx

import React, { useState } from "react";
import {
  TextField,
  Button,
  Card,
  Typography,
  InputAdornment,
} from "@mui/material";
import { Email, ArrowBack } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify"; // ✅ sirf toast, no ToastContainer here
import { validateEmail } from "../../utils/validators";

import { sendResetPasswordCodeApi } from "../../api/authApi";
import TaskFlowLogo from "../../assets/taskflow-logo.png";

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSendMail = async (e: React.FormEvent) => {
    e.preventDefault();

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      toast.error("Email is required");
      return;
    }

    if (!validateEmail(normalizedEmail)) {
      toast.error("Please enter a valid email address");
      return;
    }

    setLoading(true);

    try {
      console.log("[ForgotPassword] sending reset link for:", normalizedEmail);

      // ✅ Backend call
      const data = await sendResetPasswordCodeApi(normalizedEmail);

      console.log("[ForgotPassword] API response:", data);

      const msg =
        (data && (data.message as string)) ||
        "If this email is registered, a reset link has been sent to your email.";
      toast.success(msg);

      setEmail("");
    } catch (err: any) {
      console.error("[ForgotPassword] error:", err);

      const msg =
        err?.body?.message ||
        err?.message ||
        "Failed to send reset link. Please try again.";
      toast.error(msg);
    } finally {
      // ✅ Yahi pe button wapas normal hoga
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      {/* ❌ Yaha ToastContainer nahi hoga, global App.tsx me already hai */}

      <Card
        className="w-[450px] rounded-2xl p-8 flex flex-col items-center"
        elevation={0}
        sx={{
          backgroundColor: "rgba(255, 255, 255, 0.85)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          boxShadow: "0 12px 30px rgba(0,0,0,0.08)",
        }}
      >
        {/* Top Circular Logo */}
        <div className="w-30 h-30 rounded-full flex items-center justify-center mb-3">
          <img
            src={TaskFlowLogo}
            alt="TaskFlow Logo"
            className="w-full h-full object-contain"
          />
        </div>

        {/* Title & Subtitle */}
        <Typography variant="h5" className="font-semibold text-gray-800 pb-5">
          TaskFlow
        </Typography>
        <Typography variant="h5" className="font-bold text-gray-800 mt-2 pb-2">
          Forgot your password?
        </Typography>
        <Typography
          variant="body2"
          className="text-gray-500 text-center mb-6 pb-8"
        >
          Enter your registered email address and we’ll send you a reset link.
        </Typography>

        {/* Form */}
        <form
          onSubmit={handleSendMail}
          className="w-full flex flex-col gap-4 items-center"
        >
          <TextField
            label="Email Address"
            type="email"
            fullWidth
            size="small"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Email fontSize="small" />
                </InputAdornment>
              ),
            }}
          />

          <Button
            type="submit"
            fullWidth
            variant="contained"
            disabled={loading}
            sx={{
              background: "linear-gradient(90deg, #007bff 0%, #0a54c3 100%)",
              "&:hover": {
                background: "linear-gradient(90deg, #007bff 0%, #0849ab 100%)",
              },
              borderRadius: "8px",
              textTransform: "none",
              py: 1.2,
              fontWeight: 600,
            }}
          >
            {loading ? "Sending..." : "Send Reset Link"}
          </Button>
        </form>

        {/* Back to Login */}
        <Button
          onClick={() => navigate("/login")}
          startIcon={<ArrowBack />}
          sx={{
            textTransform: "none",
            color: "#0a54c3",
            fontWeight: 500,
            mt: 2,
          }}
        >
          Back to Login
        </Button>
      </Card>
    </div>
  );
};

export default ForgotPassword;
