// src/pages/users/UserDialog.tsx

import React from "react";
import {
  Dialog,
  DialogContent,
  Box,
  Typography,
  IconButton,
  Divider,
} from "@mui/material";

import CloseIcon from "@mui/icons-material/Close";
import { toast } from "react-toastify";
import UserForm from "../../components/user/UserForm"; // path tumhare project ke hisaab se
import { AppUser } from "../../utils/storage";

// Extended type: AppUser + optional mongoId (real backend UserID)
type ExtendedAppUser = AppUser & {
  mongoId?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: (user?: AppUser) => void;
  initial?: ExtendedAppUser;
};

const UserDialog: React.FC<Props> = ({ open, onClose, onSaved, initial }) => {
  const isEdit = Boolean(initial);

  const handleClose = (_event: any, reason?: string) => {
    if (reason === "backdropClick" || reason === "escapeKeyDown") {
      toast.info("Please use the Cancel button to close this dialog.");
      return;
    }
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullWidth
      maxWidth="md"
      scroll="paper"
      PaperProps={{
        sx: {
          borderRadius: 3,
          bgcolor: "#f9fafb",
          boxShadow: "0px 8px 30px rgba(0,0,0,0.1)",
          overflow: "visible",
        },
      }}
    >
      <DialogContent
        sx={{
          p: 2,
          overflow: "visible",
          maxHeight: "unset",
        }}
      >
        {/* HEADER */}
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          mb={2}
        >
          <Typography
            variant="h6"
            sx={{
              fontWeight: 700,
              fontSize: "1.6rem",
              color: "#111827",
            }}
          >
            <span className="text-gradient bg-clip-text text-transparent bg-linear-to-r from-[#007bff] to-[#0a54c3]">
              {isEdit ? "Edit" : "Add New"}
            </span>{" "}
            User
          </Typography>

          {/* Close Icon */}
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>

        <Divider sx={{ mb: 3 }} />

        {/* FORM */}
        <Box sx={{ overflowY: "visible", maxHeight: "100%", pb: 0 }}>
          <UserForm
            initial={initial}
            isEdit={isEdit}
            onCancel={onClose}
            onSave={async (user) => {
              await onSaved(user);
              onClose();
            }}
          />
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default UserDialog;
