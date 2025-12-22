// components/NoRowsMessage.tsx
import { Box, Typography } from "@mui/material";

const NoRowsMessage = ({ message }: { message: string }) => {
  return (
    <Box
      sx={{
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "text.secondary",
      }}
    >
      <Typography variant="body1">{message}</Typography>
    </Box>
  );
};

export default NoRowsMessage;
