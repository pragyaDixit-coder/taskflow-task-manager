import React from "react";
import { Button, Card, Typography } from "@mui/material";
import { WarningAmber, ArrowBack } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import TaskFlowLogo from "../../assets/taskflow-logo.png";

const InvalidPage: React.FC = () => {
  const navigate = useNavigate();

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
        <Typography
          variant="h5"
          className="font-semibold text-gray-800 text-center"
        >
          Task Manager
        </Typography>

        {/* Warning Icon */}
        <div className="bg-orange-100 p-3 rounded-full mb-3 mt-5">
          <WarningAmber className="text-orange-500" fontSize="large" />
        </div>

        {/* Title & Message */}
        <Typography
          variant="h5"
          className="font-semibold text-gray-800 text-center pb-2"
        >
          Invalid or Expired Link
        </Typography>
        <Typography
          variant="body2"
          className="text-gray-500 text-center mt-2 mb-6 pb-5"
        >
          Your reset link is invalid or has expired.
          <br />
          Please try again or request a new reset link.
        </Typography>

        {/* Buttons */}
        <div className="w-full flex flex-col gap-4">
          <Button
            fullWidth
            variant="contained"
            startIcon={<ArrowBack />}
            sx={{
              background: "linear-gradient(90deg, #007bff 0%, #0a54c3 100%)",
              "&:hover": {
                background: "linear-gradient(90deg, #007bff 0%, #0849ab 100%)",
              },
              borderRadius: "8px",
              textTransform: "none",
              py: 1.1,
              fontWeight: 600,
            }}
            onClick={() => navigate("/login")}
          >
            Back to Login
          </Button>

          <Button
            fullWidth
            variant="outlined"
            sx={{
              borderColor: "#ccc",
              color: "#333",
              borderRadius: "8px",
              textTransform: "none",
              py: 1.1,
              fontWeight: 500,
              "&:hover": {
                backgroundColor: "#f9f9f9",
                borderColor: "#bbb",
              },
            }}
            // 🔁 New reset link ke liye Forgot Password page par bhejna
            onClick={() => navigate("/forgot-password")}
          >
            Request New Link
          </Button>
        </div>
      </Card>

      {/* Footer */}
      <div className="absolute bottom-6 text-center">
        <Typography variant="body2" className="text-white">
          Need help?{" "}
          <span className="text-yellow-200 cursor-pointer hover:underline">
            Contact Support
          </span>
        </Typography>
        <Typography variant="caption" className="text-gray-200 mt-2 block">
          © Task Manager 2025
        </Typography>
      </div>
    </div>
  );
};

export default InvalidPage;
