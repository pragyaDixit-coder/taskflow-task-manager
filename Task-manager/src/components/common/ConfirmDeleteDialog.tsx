import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
} from "@mui/material";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";

export type ConfirmDeleteDialogProps = {
  open: boolean;
  onClose?: () => void;   // ✅ modern prop
  onCancel?: () => void;  // ✅ backward compatibility
  onConfirm: () => void | Promise<void>;
  title?: string;
  message?: string;
  loading?: boolean;      // ✅ Added support for loading
};

const ConfirmDeleteDialog: React.FC<ConfirmDeleteDialogProps> = ({
  open,
  onClose,
  onCancel,
  onConfirm,
  title = "Confirm Delete",
  message = "Are you sure you want to delete this item? This action cannot be undone.",
  loading = false,
}) => {
  // ✅ Handle both onClose and onCancel gracefully
  const handleClose = () => {
    if (onClose) onClose();
    else if (onCancel) onCancel();
  };

  return (
    <Dialog
      open={open}
      onClose={(e, reason) => {
        if (reason === "backdropClick") return; // prevent accidental close
        handleClose();
      }}
      maxWidth="xs"
      fullWidth
      sx={{
        "& .MuiPaper-root": {
          borderRadius: "12px",
          boxShadow: "0px 6px 18px rgba(0,0,0,0.25)",
        },
      }}
    >
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          fontWeight: 600,
          color: "#b71c1c",
        }}
      >
        <WarningAmberIcon color="error" /> {title}
      </DialogTitle>

      <DialogContent>
        <Typography sx={{ color: "#555", fontSize: 15 }}>{message}</Typography>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        <Button
          variant="outlined"
          onClick={handleClose}
          sx={{
            textTransform: "none",
            fontWeight: 600,
            color: "#555",
            borderColor: "#ccc",
          }}
        >
          Cancel
        </Button>

        <Button
          variant="contained"
          color="error"
          onClick={onConfirm}
          disabled={loading}
          sx={{
            background: "linear-gradient(90deg, #ff4d4d 0%, #c20000 100%)",
            "&:hover": {
              background: "linear-gradient(90deg, #ff4d4d 0%, #a50000 100%)",
            },
            textTransform: "none",
            fontWeight: 600,
          }}
        >
          {loading ? "Deleting..." : "Delete"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConfirmDeleteDialog;
