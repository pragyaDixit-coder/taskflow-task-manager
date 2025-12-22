// src/pages/settings/SettingsPage.tsx
import React from "react";
import { Box, Card, CardContent, Typography } from "@mui/material";
import { Settings as SettingsIcon } from "lucide-react";

/**
 * Simple Settings "Coming Soon" page.
 * - Centers a small white card with an icon and "Coming Soon" text.
 * - Uses MUI for consistent look with your app.
 */

const SettingsPage: React.FC = () => {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f7fafc",
        p: 4,
      }}
    >
      <Card
        elevation={6}
        sx={{
          width: 320,
          maxWidth: "90%",
          borderRadius: 2,
          textAlign: "center",
          background: "#ffffff",
        }}
      >
        <CardContent sx={{ py: 6 }}>
          <Box
            sx={{
              width: 64,
              height: 64,
              mx: "auto",
              mb: 2,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background:
                "linear-gradient(135deg, rgba(10,84,195,0.1) 0%, rgba(0,123,255,0.06) 100%)",
            }}
          >
            <SettingsIcon size={28} color="#0a54c3" />
          </Box>

          <Typography variant="h6" component="div" sx={{ fontWeight: 600, mb: 1 }}>
            Coming Soon
          </Typography>

          <Typography variant="body2" color="text.secondary">
            We’re working on the settings page. It’ll be available soon.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default SettingsPage;
