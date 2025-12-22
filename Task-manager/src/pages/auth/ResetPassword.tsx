// src/pages/auth/ResetPassword.tsx
import React, { useState, useEffect } from "react";
import {
  TextField,
  Button,
  Card,
  Typography,
  InputAdornment,
  IconButton,
} from "@mui/material";
import { Visibility, VisibilityOff, Lock } from "@mui/icons-material";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { validatePassword } from "../../utils/validators";
import TaskFlowLogo from "../../assets/taskflow-logo.png";
import {
  validateResetPasswordCodeApi,
  resetPasswordApi,
} from "../../api/authApi";

const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const { resetPasswordCode: rawResetPasswordCode } = useParams<{
    resetPasswordCode: string;
  }>();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);

  // Trimmed code derived from URL param (defensive)
  const resetPasswordCode = String(rawResetPasswordCode ?? "").trim();

  // Ensure fields are cleared on mount (defensive)
  useEffect(() => {
    setNewPassword("");
    setConfirmPassword("");
  }, []);

  // On mount: validate code
  useEffect(() => {
    const validateCode = async () => {
      if (!resetPasswordCode) {
        toast.error("Invalid reset link");
        navigate("/invalidpage");
        return;
      }

      console.log(
        "[ResetPassword] URL param resetPasswordCode (trimmed):",
        resetPasswordCode
      );

      try {
        // use trimmed code for validation
        await validateResetPasswordCodeApi(resetPasswordCode);
        // valid
      } catch (err: any) {
        const msg =
          err?.body?.message || err?.message || "Invalid or expired reset link";

        console.error("[ResetPassword] validate error:", err);
        toast.error(msg);
        navigate("/invalidpage");
        return;
      } finally {
        setValidating(false);
      }
    };

    validateCode();
  }, [resetPasswordCode, navigate]);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validatePassword(newPassword)) {
      toast.error(
        "Password must be 8–18 chars, include 1 uppercase, 1 number, 1 special char"
      );
      return;
    }

    if (confirmPassword !== newPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (!resetPasswordCode) {
      toast.error("Invalid reset link");
      navigate("/invalidpage");
      return;
    }

    console.log(
      "[ResetPassword] submitting with code (trimmed):",
      resetPasswordCode
    );

    setLoading(true);

    try {
      // CALL resetPasswordApi with two args (as typed): resetPasswordCode, newPassword
      await resetPasswordApi(resetPasswordCode, newPassword);

      toast.success("Password reset successful! Please login.");
      setTimeout(() => navigate("/login"), 1200);
    } catch (err: any) {
      // Show structured backend message when available
      const backendMessage: string | undefined = err?.body?.message;
      const msg =
        backendMessage ||
        err?.message ||
        "Failed to reset password. Please try again.";

      console.error("[ResetPassword] reset error:", err);

      // Helpful debug toast during development
      if (import.meta.env.MODE !== "production") {
        // show full error body if available (non-intrusive)
        // eslint-disable-next-line no-console
        console.debug("[ResetPassword] full error:", err);
      }

      toast.error(msg);

      if (
        backendMessage === "Invalid Code." ||
        backendMessage === "Code is expired."
      ) {
        navigate("/invalidpage");
      }
    } finally {
      setLoading(false);
    }
  };

  if (validating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#e8f0f2]">
        <Typography variant="body1">Validating reset link...</Typography>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center ">
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
        <Typography variant="h5" className="font-semibold text-gray-800 pb-2">
          Reset your password
        </Typography>
        <Typography
          variant="body2"
          className="text-gray-500 text-center mb-6 pb-8"
        >
          Enter your new password below to reset your account.
        </Typography>

        {/* Form */}
        <form
          onSubmit={handleReset}
          className="w-full flex flex-col gap-8 items-center"
        >
          {/* New Password */}
          <TextField
            label="New Password"
            type={showPassword ? "text" : "password"}
            fullWidth
            size="small"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Lock fontSize="small" />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => setShowPassword(!showPassword)}
                    edge="end"
                    size="small"
                  >
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          {/* Confirm Password */}
          <TextField
            label="Confirm Password"
            type={showConfirm ? "text" : "password"}
            fullWidth
            size="small"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="off"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Lock fontSize="small" />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => setShowConfirm(!showConfirm)}
                    edge="end"
                    size="small"
                  >
                    {showConfirm ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          {/* Reset Button */}
          <Button
            type="submit"
            fullWidth
            variant="contained"
            disabled={loading}
            sx={{
              mt: 1,
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
            {loading ? "Resetting..." : "Reset Password"}
          </Button>
        </form>
      </Card>
    </div>
  );
};

export default ResetPassword;
