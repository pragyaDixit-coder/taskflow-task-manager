// src/pages/state/AddEditStateModal.tsx

import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  IconButton,
  MenuItem,
  Select,
  InputLabel,
  FormControl,
} from "@mui/material";

import CloseIcon from "@mui/icons-material/Close";
import { toast } from "react-toastify";

import {
  getStateById,
  createState,
  updateState,
  checkDuplicateStateName,
} from "../../services/stateService";

import {
  getCountries,
  getAllCountriesIncludingDeleted,
} from "../../services/countryService";

type CountryNormalized = {
  id: string;
  name: string;
  isDeleted?: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editId?: string | null; // Mongo ObjectId as string
};

const AddEditStateModal: React.FC<Props> = ({
  open,
  onClose,
  onSaved,
  editId = null,
}) => {
  const [name, setName] = useState("");
  const [countryId, setCountryId] = useState<string | "">("");

  const [loading, setLoading] = useState(false);

  const [countries, setCountries] = useState<CountryNormalized[]>([]);
  const [allCountries, setAllCountries] = useState<CountryNormalized[]>([]);

  const [errors, setErrors] = useState<{ name?: string; country?: string }>({});

  /* --------------------------------------------------
       LOAD COUNTRIES (active + deleted) and NORMALIZE ids to string
  -------------------------------------------------- */
  useEffect(() => {
    if (open) {
      setErrors({});

      (async () => {
        try {
          const active = await getCountries(); // may return id:number or id:string
          const all = await getAllCountriesIncludingDeleted();

          // normalize to string ids so TS types remain consistent
          const activeNorm: CountryNormalized[] = (active || []).map(
            (c: any) => ({
              id: String(c.id ?? c._id ?? c.id),
              name: c.name ?? c.countryName ?? "",
              isDeleted: !!c.isDeleted,
            })
          );

          const allNorm: CountryNormalized[] = (all || []).map((c: any) => ({
            id: String(c.id ?? c._id ?? c.id),
            name: c.name ?? c.countryName ?? "",
            isDeleted: !!c.isDeleted,
          }));

          setCountries(activeNorm);
          setAllCountries(allNorm);
        } catch (err) {
          console.error("Failed to load countries", err);
          toast.error("Failed to load countries");
        }
      })();
    }
  }, [open]);

  /* --------------------------------------------------
       LOAD STATE (active or deleted)
  -------------------------------------------------- */
  useEffect(() => {
    if (editId && open) {
      (async () => {
        try {
          const s = await getStateById(editId);

          if (s) {
            setName(s.name);
            setCountryId(String(s.countryId ?? ""));
          }
        } catch (err) {
          console.error("Failed to load state", err);
          toast.error("Failed to load state");
        }
      })();
    } else if (open) {
      setName("");
      setCountryId("");
      setErrors({});
    }
  }, [editId, open]);

  /* --------------------------------------------------
        VALIDATION (with backend duplicate check)
  -------------------------------------------------- */
  const validate = async (): Promise<boolean> => {
    const e: { name?: string; country?: string } = {};

    if (!name.trim()) e.name = "State name is required";
    else if (name.trim().length > 50) e.name = "Max 50 characters allowed";

    if (!countryId) e.country = "Please select a country";

    // agar basic validation pass ho jaye to backend se duplicate check karo
    if (!e.name && !e.country && countryId) {
      try {
        const isDuplicate = await checkDuplicateStateName({
          StateName: name.trim(),
          CountryID: countryId,
          ExcludeID: editId ?? undefined,
        });

        if (isDuplicate) {
          e.name = "This state already exists in selected country";
        }
      } catch (err) {
        console.error("Duplicate check failed", err);
        // Yaha validation ko fail mat karo, sirf info do
        toast.error("Failed to check duplicate state");
      }
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  /* --------------------------------------------------
        SAVE HANDLER
  -------------------------------------------------- */
  const handleSave = async () => {
    const isValid = await validate();
    if (!isValid) return;

    setLoading(true);

    try {
      const stateName = name.trim();
      const payloadCountryId = String(countryId);

      if (editId) {
        await updateState({
          stateID: editId,
          stateName,
          countryId: payloadCountryId,
        });
        toast.success("State updated successfully");
      } else {
        await createState({
          stateName,
          countryId: payloadCountryId,
        });
        toast.success("State added successfully");
      }

      onSaved();
      onClose();
    } catch (err: any) {
      console.error(err);

      // Agar backend se duplicate error aaya (409 / message)
      const msg = err?.body?.message || err?.message || "Operation failed";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  /* --------------------------------------------------
        PREVENT BACKDROP + ESC CLOSE
  -------------------------------------------------- */
  const handleDialogClose = (_event: any, reason?: string) => {
    if (reason === "backdropClick" || reason === "escapeKeyDown") {
      toast.info("Please click Cancel or Close icon to exit");
      return;
    }
    onClose();
  };

  /* --------------------------------------------------
        SELECTED COUNTRY (even if deleted)
  -------------------------------------------------- */
  const selectedCountry =
    allCountries.find((c) => c.id === String(countryId)) || null;

  return (
    <Dialog open={open} onClose={handleDialogClose} maxWidth="sm" fullWidth>
      <DialogTitle
        sx={{
          display: "flex",
          justifyContent: "space-between",
          fontWeight: 600,
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
          State
        </Typography>

        <IconButton size="small" onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ mt: 1 }}>
        {/* State Name */}
        <TextField
          fullWidth
          label="State Name *"
          size="small"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={Boolean(errors.name)}
          helperText={errors.name || `${name.trim().length}/50`}
          inputProps={{ maxLength: 50 }}
          sx={{ mb: 2, mt: 4 }}
        />

        {/* Country Dropdown (active + show deleted in disabled) */}
        <FormControl fullWidth size="small" error={Boolean(errors.country)}>
          <InputLabel>Country *</InputLabel>

          <Select
            label="Country *"
            value={countryId}
            onChange={(e) =>
              setCountryId(e.target.value === "" ? "" : String(e.target.value))
            }
            // `any` cast because MUI Select value can be string | number
            // but our state is string | ""
          >
            <MenuItem value="">Select a country</MenuItem>

            {/* Active Countries */}
            {countries.map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {c.name}
              </MenuItem>
            ))}

            {/* If selected country is deleted → display it */}
            {selectedCountry &&
              !countries.some((c) => c.id === selectedCountry.id) && (
                <MenuItem disabled value={selectedCountry.id}>
                  {selectedCountry.name} (deleted)
                </MenuItem>
              )}
          </Select>

          {errors.country && (
            <small style={{ color: "#d32f2f", marginTop: 4 }}>
              {errors.country}
            </small>
          )}
        </FormControl>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button variant="outlined" onClick={onClose}>
          Cancel
        </Button>

        <Button
          variant="contained"
          disabled={loading}
          sx={{
            background: "linear-gradient(90deg,#007bff,#0a54c3)",
            "&:hover": {
              background: "linear-gradient(90deg,#007bff,#0849ab)",
            },
          }}
          onClick={handleSave}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddEditStateModal;
