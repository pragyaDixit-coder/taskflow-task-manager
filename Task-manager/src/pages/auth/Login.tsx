// src/pages/auth/Login.tsx
import React, { useState, useEffect } from "react";
import {
  TextField,
  Checkbox,
  FormControlLabel,
  Button,
  Card,
  Typography,
  InputAdornment,
  IconButton,
  Box,
} from "@mui/material";
import { Email, Lock, Visibility, VisibilityOff } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { validateEmail, validatePassword } from "../../utils/validators";

import {
  getToken,
  removeToken,
  login as storageLogin,
  fetchCurrentUserFromServer,
} from "../../utils/storage";

// Import TaskFlow logo
import TaskFlowLogo from "../../assets/taskflow-logo.png";

const Login: React.FC = () => {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  // 🚫 Always clear email & password on page load (Fix autofill)
  useEffect(() => {
    setEmail("");
    setPassword("");
  }, []);

  // Redirect if token exists
  useEffect(() => {
    let cancelled = false;
    const validateTokenAndRedirect = async () => {
      try {
        const token = getToken();
        if (!token) return;

        const u = await fetchCurrentUserFromServer();
        if (u && !cancelled) navigate("/home");
      } catch {
        try {
          removeToken();
        } catch {}
      }
    };
    void validateTokenAndRedirect();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    let isValid = true;
    setEmailError("");
    setPasswordError("");

    if (!email.trim()) {
      setEmailError("Email is required");
      isValid = false;
    } else if (!validateEmail(email)) {
      setEmailError("Please enter a valid email");
      isValid = false;
    }

    if (!password.trim()) {
      setPasswordError("Password is required");
      isValid = false;
    } else if (!validatePassword(password)) {
      setPasswordError("Invalid password format");
      isValid = false;
    }

    if (!isValid) return;

    setLoading(true);

    try {
      const user = await storageLogin({
        EmailID: email.trim(),
        Password: password,
        remember: rememberMe,
      });

      if (user) {
        navigate("/home", { replace: true });
        return;
      }

      const fetched = await fetchCurrentUserFromServer();
      if (fetched) {
        navigate("/home", { replace: true });
        return;
      }

      window.location.reload();
    } catch (err: any) {
      try {
        removeToken();
      } catch {}

      const msg =
        err?.body?.message ??
        err?.body?.error ??
        err?.message ??
        (err?.status === 401
          ? "Invalid email or password"
          : "Invalid email or password");

      setPasswordError(String(msg));
    } finally {
      setLoading(false);
    }
  };

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
        {/* Logo */}
        <div className="w-30 h-30 mb-2 flex items-center justify-center rounded-full bg-amber-200 ">
          <img
            src={TaskFlowLogo}
            alt="TaskFlow Logo"
            className="w-full h-full object-contain"
          />
        </div>

        <Typography variant="h5" className="font-semibold text-gray-800">
          Sign in to TaskFlow
        </Typography>
        <Typography variant="body2" className="text-gray-500 mb-5 p-2">
          Welcome back! Please enter your details.
        </Typography>

        <form
          onSubmit={handleLogin}
          className="w-full flex flex-col gap-5 mt-7"
          noValidate
        >
          {/* Email */}
          <TextField
            label="Email"
            type="email"
            fullWidth
            variant="outlined"
            size="small"
            autoComplete="off"
            inputProps={{ autoComplete: "new-password" }} // 🚫 disable saved email
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={!!emailError}
            helperText={emailError}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Email fontSize="small" />
                </InputAdornment>
              ),
            }}
          />

          {/* Password */}
          <TextField
            label="Password"
            type={showPassword ? "text" : "password"}
            fullWidth
            variant="outlined"
            size="small"
            autoComplete="off"
            inputProps={{ autoComplete: "new-password" }} // 🚫 disable saved passwords
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={!!passwordError}
            helperText={passwordError}
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

          <Box className="flex items-center justify-between">
            <FormControlLabel
              control={
                <Checkbox
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  sx={{
                    color: "#0a54c3",
                    "&.Mui-checked": { color: "#0a54c3" },
                  }}
                />
              }
              label={
                <Typography variant="body2" className="text-gray-600">
                  Remember me
                </Typography>
              }
            />

            <Typography
              variant="body2"
              className="text-[#0a54c3] cursor-pointer hover:underline"
              onClick={() => navigate("/forgotpassword")}
            >
              Forgot password?
            </Typography>
          </Box>

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
              fontSize: 16,
              marginBottom: 2,
            }}
          >
            {loading ? "Signing in..." : "Sign in"}
          </Button>
        </form>

        <Typography variant="body2" className="text-gray-600 text-sm mt-4">
          Don’t have an account?{" "}
          <span
            className="text-[#0a54c3] cursor-pointer hover:underline font-medium"
            onClick={() => navigate("/signup")}
          >
            Sign up
          </span>
        </Typography>

        <Typography variant="caption" className="text-gray-500 mt-8 pt-4">
          © TaskFlow 2025
        </Typography>
      </Card>
    </div>
  );
};

export default Login;
