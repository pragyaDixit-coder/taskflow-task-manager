// src/pages/country/AddEditCountryModal.tsx

import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  IconButton,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

import {
  Country,
  createCountry,
  updateCountry,
  isCountryNameUnique,
  getCountryById, // async helper returning Country | null
} from "../../services/countryService";

import { toast } from "react-toastify";

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  // backend ids are strings (MongoDB _id). undefined/null when adding new.
  editId?: string | null;
};

const AddEditCountryModal: React.FC<Props> = ({
  open,
  onClose,
  onSaved,
  editId = null,
}) => {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ name?: string }>({});
  const [isDeleted, setIsDeleted] = useState(false);

  // loadedCountry holds the backend Country (if in edit mode)
  const [loadedCountry, setLoadedCountry] = useState<Country | null>(null);

  /* ---------------------------------------------
      LOAD COUNTRY (including deleted) when in edit mode
  -----------------------------------------------*/
  useEffect(() => {
    setErrors({});
    setIsDeleted(false);
    setLoadedCountry(null);
    setName("");

    if (!open) return;

    // if editId provided -> load country
    if (editId) {
      (async () => {
        try {
          const c = await getCountryById(String(editId));
          if (c) {
            setLoadedCountry(c);
            setName(c.name ?? "");
            setIsDeleted(!!c.isDeleted);
          } else {
            // not found — clear fields but inform user
            setLoadedCountry(null);
            setName("");
            setIsDeleted(false);
            toast.error("Country not found");
          }
        } catch (err) {
          console.error("Failed to load country", err);
          toast.error("Failed to load country data");
        }
      })();
    } else {
      // new record — clear
      setName("");
      setLoadedCountry(null);
      setIsDeleted(false);
    }
  }, [editId, open]);

  /* ---------------------------------------------
      VALIDATION
  -----------------------------------------------*/
  const validate = (): boolean => {
    const e: { name?: string } = {};
    const trimmed = name.trim();

    if (!trimmed) {
      e.name = "Country name is required";
    } else if (trimmed.length > 50) {
      e.name = "Max length 50 characters";
    } else {
      // excludeId should be the current record's id (when editing)
      const excludeId = editId ?? undefined;
      // isCountryNameUnique returns boolean (best-effort client-side)
      if (!isCountryNameUnique(trimmed, excludeId)) {
        e.name = "Country name must be unique";
      }
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  /* ---------------------------------------------
      SAVE HANDLER
  -----------------------------------------------*/
  const handleSave = async () => {
    if (!validate()) return;

    setLoading(true);
    try {
      const trimmed = name.trim();

      if (editId && loadedCountry) {
        // update by backend id (loadedCountry.id)
        await updateCountry({
          id: loadedCountry.id,
          name: trimmed,
        });

        toast.success(
          isDeleted ? "Country restored & updated successfully" : "Country updated successfully"
        );
      } else {
        // create new
        await createCountry({ name: trimmed });
        toast.success("Country added successfully");
      }

      // notify parent to refresh list
      onSaved();
      onClose();
    } catch (err: any) {
      console.error("Country save error:", err);
      // show backend message when available
      toast.error(err?.message || "Operation failed");
    } finally {
      setLoading(false);
    }
  };

  /* ---------------------------------------------
      Prevent close on outside click / ESC
  -----------------------------------------------*/
  const handleDialogClose = (_event: object, reason?: string) => {
    if (reason === "backdropClick" || reason === "escapeKeyDown") {
      toast.info("Please click Cancel or the Close icon to close this dialog", {
        position: "top-center",
      });
      return;
    }
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleDialogClose} maxWidth="sm" fullWidth>
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid #f9f9f9",
        }}
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
                  {editId ? "Edit" : "Add New"}
                </span>{" "}
                Country
              </Typography>
        <IconButton size="small" onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        <div style={{ marginTop: 12, padding: 14 }}>
          {/* Label */}
          <Typography
            variant="body1"
            sx={{
              fontWeight: 600,
              fontSize: 16,
              color: "#000",
              marginBottom: 2,
            }}
          >
            Country Name <span style={{ color: "red" }}>*</span>
          </Typography>

          {/* Input */}
          <TextField
            fullWidth
            value={name}
            onChange={(e) => setName(e.target.value)}
            inputProps={{ maxLength: 50 }}
            helperText={errors.name ? errors.name : `${name.trim().length}/50`}
            error={Boolean(errors.name)}
            size="medium"
          />
        </div>

        {/* Show deleted badge */}
        {isDeleted && (
          <Typography sx={{ color: "red", ml: 2, mt: 1, fontWeight: 600 }}>
            ⚠ This country was deleted — editing will restore it.
          </Typography>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2, gap: 3, backgroundColor: "#f9f9f9" }}>
        <Button onClick={onClose}>Cancel</Button>

        <Button
          onClick={handleSave}
          variant="contained"
          sx={{
            background: "linear-gradient(90deg, #007bff 0%, #0a54c3 100%)",
            "&:hover": {
              background: "linear-gradient(90deg, #007bff 0%, #0849ab 100%)",
            },
          }}
          disabled={loading}
        >
          {editId ? "Save Changes" : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddEditCountryModal;
