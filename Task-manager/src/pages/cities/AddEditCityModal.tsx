// src/pages/cities/AddEditCityModal.tsx
import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Button,
  TextField,
  Typography,
  MenuItem,
  IconButton,
  Divider,
  Box,
  Grid,
} from "@mui/material";

import CloseIcon from "@mui/icons-material/Close";
import { toast } from "react-toastify";

import {
  createCity,
  updateCity,
  checkDuplicateCityName,
  getCityById,
} from "../../services/cityService";

import {
  getStates,
  getAllStatesIncludingDeleted,
} from "../../services/stateService";

import {
  getCountries,
  getAllCountriesIncludingDeleted,
} from "../../services/countryService";

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editId?: string | undefined;
};

const AddEditCityModal: React.FC<Props> = ({
  open,
  onClose,
  onSaved,
  editId,
}) => {
  const [name, setName] = useState("");
  const [stateId, setStateId] = useState<string | "">("");
  const [zipText, setZipText] = useState("");

  const [states, setStates] = useState<any[]>([]);
  const [allStates, setAllStates] = useState<any[]>([]);
  const [countries, setCountries] = useState<any[]>([]);
  const [allCountries, setAllCountries] = useState<any[]>([]);

  const [errors, setErrors] = useState<any>({});
  const [loading, setLoading] = useState(false);

  /* ----------------------------------------
        LOAD STATES + COUNTRIES (ACTIVE + DELETED)
  ---------------------------------------- */
  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const [activeStates, activeCountries] = await Promise.all([
          getStates(),
          getCountries(),
        ]);
        setStates(
          (activeStates || []).map((s: any) => ({
            ...s,
            id: String(s.id ?? s._id ?? ""),
            name: s.name ?? s.stateName ?? "",
            countryId: String(s.countryId ?? s.countryID ?? ""),
            isDeleted: !!s.isDeleted,
          }))
        );
        setCountries(
          (activeCountries || []).map((c: any) => ({
            ...c,
            id: String(c.id ?? c._id ?? ""),
            name: c.name ?? c.countryName ?? "",
            isDeleted: !!c.isDeleted,
          }))
        );

        // fetch all including deleted (await)
        const [allS, allC] = await Promise.all([
          getAllStatesIncludingDeleted(),
          getAllCountriesIncludingDeleted(),
        ]);
        setAllStates(
          (allS || []).map((s: any) => ({
            ...s,
            id: String(s.id ?? s._id ?? ""),
            name: s.name ?? s.stateName ?? "",
            countryId: String(s.countryId ?? s.countryID ?? ""),
            isDeleted: !!s.isDeleted,
          }))
        );
        setAllCountries(
          (allC || []).map((c: any) => ({
            ...c,
            id: String(c.id ?? c._id ?? ""),
            name: c.name ?? c.countryName ?? "",
            isDeleted: !!c.isDeleted,
          }))
        );
      } catch (err) {
        console.error("Failed to load states/countries", err);
        toast.error("Failed to load location data");
      }
    })();
  }, [open]);

  /* ----------------------------------------
        EDIT MODE
  ---------------------------------------- */
  useEffect(() => {
    if (!open) return;

    if (editId) {
      (async () => {
        try {
          const c = await getCityById(editId);
          if (c) {
            setName(c.name ?? "");
            setStateId(String(c.stateId ?? ""));
            setZipText((c.zipCodes || []).join(", "));
          }
        } catch (err) {
          console.error("Failed to load city:", err);
          toast.error("Failed to load city for edit");
        }
      })();
    } else {
      // new
      setName("");
      setStateId("");
      setZipText("");
      setErrors({});
    }
  }, [editId, open]);

  /* ----------------------------------------
        ZIP PARSER
  ---------------------------------------- */
  const parseZips = (raw: string): string[] =>
    raw
      .split(/[\n,]+/)
      .map((z) => z.trim())
      .filter((z) => z.length > 0);

  /* ----------------------------------------
        VALIDATION (uses backend duplicate check)
  ---------------------------------------- */
  const validate = async (): Promise<{ ok: boolean; details: string[] }> => {
    const e: any = {};
    const details: string[] = [];

    if (!name.trim()) {
      e.name = "City name is required";
      details.push("City name is required");
    }

    if (!stateId) {
      e.state = "State selection is required";
      details.push("State is required");
    }

    const zips = parseZips(zipText);
    const invalid = zips.filter((z) => z.length > 6);
    if (invalid.length) {
      e.zip = `Invalid ZIPs: ${invalid.join(", ")}`;
      details.push("ZIP must be up to 6 characters");
    }

    // only check duplicate when name+state present and no basic errors
    if (!e.name && !e.state) {
      try {
        const isDup = await checkDuplicateCityName({
          CityName: name.trim(),
          StateID: String(stateId),
          ExcludeID: editId ?? null,
        });
        if (isDup) {
          e.name = "City already exists in selected state";
          details.push("City name must be unique in the selected state");
        }
      } catch (err) {
        // if duplicate-check fails, treat as non-blocking but log
        console.error("Duplicate check failed:", err);
      }
    }

    setErrors(e);
    return { ok: Object.keys(e).length === 0, details };
  };

  /* ----------------------------------------
        SAVE CITY
  ---------------------------------------- */
  const handleSave = async () => {
    const res = await validate();
    if (!res.ok) {
      toast.error(
        <div>
          <strong>Validation errors:</strong>
          {res.details.map((d, i) => (
            <div key={i}>{d}</div>
          ))}
        </div>,
        { autoClose: 6000 }
      );
      return;
    }

    setLoading(true);
    try {
      const payload = {
        cityName: name.trim(),
        stateId: String(stateId),
        zipCodes: parseZips(zipText),
      };

      if (editId) {
        await updateCity({
          cityID: String(editId),
          cityName: payload.cityName,
          stateId: payload.stateId,
          zipCodes: payload.zipCodes,
        });
        toast.success("City updated successfully");
      } else {
        await createCity({
          cityName: payload.cityName,
          stateId: payload.stateId,
          zipCodes: payload.zipCodes,
        });
        toast.success("City added successfully");
      }

      onSaved();
      onClose();
    } catch (err: any) {
      console.error(err);
      // backend might return friendly message
      const msg = err?.message ?? "Operation failed";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  /* ----------------------------------------
        PREVENT CLOSE ON ESC/BACKDROP
  ---------------------------------------- */
  const handleDialogClose = (_e: any, reason?: string) => {
    if (reason === "backdropClick" || reason === "escapeKeyDown") {
      toast.info("Please click Cancel or Close to exit");
      return;
    }
    onClose();
  };

  /* ----------------------------------------
        SELECTED STATE & COUNTRY (even deleted)
  ---------------------------------------- */
  const selectedState = allStates.find((s) => String(s.id) === String(stateId));
  const selectedCountry = selectedState
    ? allCountries.find((c) => String(c.id) === String(selectedState.countryId))
    : null;

  /* ----------------------------------------
        RENDER
  ---------------------------------------- */
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
         City
        </Typography>
        <IconButton onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 2 }}>
        <Grid item xs={12}>
          <div className="bg-white p-4 rounded">
            {/* CITY NAME */}
            <TextField
              label="City Name *"
              fullWidth
              size="small"
              value={name}
              onChange={(e) => setName(e.target.value)}
              helperText={errors.name || `${name.trim().length}/50`}
              error={Boolean(errors.name)}
              sx={{ mb: 2 }}
            />

            {/* STATE DROPDOWN — SUPPORT DELETED */}
            <TextField
              select
              fullWidth
              size="small"
              label="State *"
              value={stateId}
              onChange={(e) =>
                setStateId(e.target.value === "" ? "" : String(e.target.value))
              }
              error={Boolean(errors.state)}
              helperText={errors.state}
              sx={{ mb: 2 }}
            >
              <MenuItem value="">Select a state…</MenuItem>

              {/* Active states */}
              {states.map((s) => (
                <MenuItem key={s.id} value={s.id}>
                  {s.name}
                </MenuItem>
              ))}

              {/* Deleted state (only if selected during edit) */}
              {selectedState &&
                !states.some(
                  (s) => String(s.id) === String(selectedState.id)
                ) && (
                  <MenuItem disabled value={selectedState.id}>
                    {selectedState.name} (deleted)
                  </MenuItem>
                )}
            </TextField>

            {/* COUNTRY DISPLAY (Readonly) */}
            {selectedCountry && (
              <TextField
                label="Country"
                fullWidth
                size="small"
                value={
                  selectedCountry.isDeleted
                    ? `${selectedCountry.name} (deleted)`
                    : selectedCountry.name
                }
                disabled
                sx={{ mb: 2 }}
              />
            )}

            {/* ZIP CODES */}
            <TextField
              label="ZIP Code(s)"
              fullWidth
              multiline
              minRows={4}
              value={zipText}
              placeholder="ZIPs separated by comma or new line"
              onChange={(e) => setZipText(e.target.value)}
              helperText={
                errors.zip || `Valid ZIPs: ${parseZips(zipText).length}`
              }
              error={Boolean(errors.zip)}
            />

            <Divider sx={{ my: 3 }} />

            <Box className="flex gap-3">
              <Button
                variant="contained"
                disabled={loading}
                onClick={handleSave}
                sx={{ background: "linear-gradient(90deg,#007bff,#0a54c3)" }}
              >
                {loading ? "Saving..." : "Save City"}
              </Button>

              <Button variant="outlined" onClick={onClose}>
                Cancel
              </Button>
            </Box>
          </div>
        </Grid>
      </DialogContent>
    </Dialog>
  );
};

export default AddEditCityModal;
