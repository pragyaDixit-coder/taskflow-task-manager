// src/components/users/UserForm.tsx
import React, { useEffect, useState, ChangeEvent, useRef } from "react";
import {
  TextField,
  Button,
  MenuItem,
  FormControlLabel,
  Checkbox,
  Avatar,
  Box,
  Grid,
  IconButton,
  Tooltip,
} from "@mui/material";
import PhotoCamera from "@mui/icons-material/PhotoCamera";
import DeleteIcon from "@mui/icons-material/Delete";

import {
  getCountries,
  getAllCountriesIncludingDeleted,
} from "../../services/countryService";

// stateService may export getStates / getAllStatesIncludingDeleted
import * as stateService from "../../services/stateService";

import {
  getCitiesByState,
  getAllCitiesIncludingDeleted,
} from "../../services/cityService";

import { AppUser } from "../../utils/storage";
import { toast } from "react-toastify";

// backend user management APIs
import {
  insertUserApi,
  updateUserApi,
  checkDuplicateEmailForUserApi,
} from "../../api/userManagementApi";

// --------------------
// Config: Avatar size limit (MB)
const MAX_AVATAR_SIZE_MB = 2; // <-- change this value to configure allowed size
const MAX_AVATAR_BYTES = MAX_AVATAR_SIZE_MB * 1024 * 1024;

// --------------------
// Local types
// --------------------
type Raw = Record<string, any>;

type CountryItem = {
  id: string;
  name: string;
  isDeleted?: boolean;
};

type StateItemType = {
  id: string;
  name: string;
  countryId?: string;
  isDeleted?: boolean;
};

type CityItemType = {
  id: string;
  name: string;
  stateId?: string;
  isDeleted?: boolean;
};

type ExtendedAppUser = AppUser & { mongoId?: string };

/* ---------- Props ---------- */
type Props = {
  initial?: Partial<ExtendedAppUser>;
  onCancel: () => void;
  onSave: (user: AppUser, password?: string) => Promise<void> | void;
  isEdit?: boolean;
};

const toStr = (v: any) => (v === null || v === undefined ? "" : String(v));

/* ---------- helpers ---------- */
function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

/* ---------- Component ---------- */
const UserForm: React.FC<Props> = ({
  initial = {},
  onCancel,
  onSave,
  isEdit = false,
}) => {
  /* -------------------------
     Form fields
  ------------------------- */
  const [firstName, setFirstName] = useState(initial.firstName ?? "");
  const [lastName, setLastName] = useState(initial.lastName ?? "");
  const [email, setEmail] = useState(initial.email ?? "");
  const [address, setAddress] = useState(initial.address ?? "");
  const [zip, setZip] = useState(initial.zip ?? "");
  const [avatar, setAvatar] = useState<string | null>(initial.avatarUrl ?? null);
  const [changePassword, setChangePassword] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  /* -------------------------
     Location lists (normalized ids = string)
  ------------------------- */
  const [countries, setCountries] = useState<CountryItem[]>([]);
  const [states, setStates] = useState<StateItemType[]>([]);
  const [cities, setCities] = useState<CityItemType[]>([]);

  /* all* lists (including deleted) */
  const [allCountries, setAllCountries] = useState<CountryItem[]>([]);
  const [allStates, setAllStates] = useState<StateItemType[]>([]);
  const [allCities, setAllCities] = useState<CityItemType[]>([]);

  /* -------------------------
     Selected IDs (strings)
  ------------------------- */
  const [countryId, setCountryId] = useState<string | "">(toStr(initial.countryId ?? ""));
  const [stateId, setStateId] = useState<string | "">(toStr(initial.stateId ?? ""));
  const [cityId, setCityId] = useState<string | "">(toStr(initial.cityId ?? ""));

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Backend real user ID for edit (optional)
  const mongoId = (initial as ExtendedAppUser).mongoId;

  /* -------------------------
     Sync when `initial` changes (important when dialog is reused)
     IMPORTANT: depend on stable primitive (mongoId) NOT whole object
  ------------------------- */
  useEffect(() => {
    setFirstName(initial.firstName ?? "");
    setLastName(initial.lastName ?? "");
    setEmail(initial.email ?? "");
    setAddress(initial.address ?? "");
    setZip(initial.zip ?? "");
    setAvatar(initial.avatarUrl ?? null);
    setCountryId(toStr(initial.countryId ?? ""));
    setStateId(toStr(initial.stateId ?? ""));
    setCityId(toStr(initial.cityId ?? ""));
    // reset password fields when switching user
    setPassword("");
    setConfirm("");
    // only relevant for edit; ensure false when switching contexts
    setChangePassword(false);
    setErrors({});
  }, [initial?.mongoId ?? initial?.id]); // <- stable dependency

  /* --------------------------------------------------
     LOAD ALL (including deleted) for showing existing values
  -------------------------------------------------- */
  useEffect(() => {
    (async () => {
      try {
        // COUNTRIES (all)
        let allC: Raw[] = [];
        if (typeof getAllCountriesIncludingDeleted === "function") {
          allC = (await getAllCountriesIncludingDeleted()) || [];
        } else {
          allC = (await getCountries()) || [];
        }
        const mappedCountries: CountryItem[] = (allC || []).map((c: Raw) => ({
          id: toStr(c.id ?? c._id ?? c.countryID ?? c.countryId ?? ""),
          name: c.name ?? c.countryName ?? "",
          isDeleted: !!c.isDeleted,
        }));
        setAllCountries(mappedCountries);

        // STATES (all)
        let allS: Raw[] = [];
        if (typeof (stateService as any).getAllStatesIncludingDeleted === "function") {
          allS = (await (stateService as any).getAllStatesIncludingDeleted()) || [];
        } else if (typeof (stateService as any).getStates === "function") {
          allS = (await (stateService as any).getStates()) || [];
        }
        const mappedStates: StateItemType[] = (allS || []).map((s: Raw) => ({
          id: toStr(s.id ?? s._id ?? s.stateID ?? ""),
          name: s.name ?? s.stateName ?? "",
          countryId: toStr(s.countryId ?? s.countryID ?? s.country ?? ""),
          isDeleted: !!s.isDeleted,
        }));
        setAllStates(mappedStates);

        // CITIES (all)
        let allCt: Raw[] = [];
        if (typeof getAllCitiesIncludingDeleted === "function") {
          allCt = (await getAllCitiesIncludingDeleted()) || [];
        }
        const mappedCities: CityItemType[] = (allCt || []).map((c: Raw) => ({
          id: toStr(c.id ?? c._id ?? c.cityID ?? ""),
          name: c.name ?? c.cityName ?? "",
          stateId: toStr(c.stateId ?? c.stateID ?? c.state ?? ""),
          isDeleted: !!c.isDeleted,
        }));
        setAllCities(mappedCities);
      } catch (err) {
        console.error("Failed to load all location data", err);
      }
    })();
    // run once on mount
  }, []);

  /* --------------------------------------------------
     LOAD ONLY ACTIVE dropdown options (when country/state changes)
  -------------------------------------------------- */
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // COUNTRIES: active
        const countriesData: Raw[] = (await getCountries()) || [];
        const normCountries: CountryItem[] = countriesData.map((c: Raw) => ({
          id: toStr(c.id ?? c._id ?? c.countryID ?? c.countryId ?? ""),
          name: c.name ?? c.countryName ?? "",
          isDeleted: !!c.isDeleted,
        }));
        if (!mounted) return;
        setCountries(normCountries);

        // STATES (active) - use stateService.getStates if available
        let statesData: Raw[] = [];
        if (typeof (stateService as any).getStates === "function") {
          statesData = (await (stateService as any).getStates()) || [];
        }
        const normStatesAll: StateItemType[] = (statesData || []).map((s: Raw) => ({
          id: toStr(s.id ?? s._id ?? s.stateID ?? ""),
          name: s.name ?? s.stateName ?? "",
          countryId: toStr(s.countryId ?? s.countryID ?? s.country ?? ""),
          isDeleted: !!s.isDeleted,
        }));
        if (!mounted) return;
        const statesForCountry: StateItemType[] = countryId
          ? normStatesAll.filter((s) => s.countryId === countryId)
          : normStatesAll;
        setStates(statesForCountry);
        setAllStates((prev) => (prev.length ? prev : normStatesAll));

        // CITIES: active for selected state
        if (stateId) {
          const citiesData: Raw[] = (await getCitiesByState(String(stateId))) || [];
          const normCities: CityItemType[] = (citiesData || []).map((c: Raw) => ({
            id: toStr(c.id ?? c._id ?? c.cityID ?? ""),
            name: c.name ?? c.cityName ?? "",
            stateId: toStr(c.stateId ?? c.stateID ?? c.state ?? ""),
            isDeleted: !!c.isDeleted,
          }));
          if (!mounted) return;
          setCities(normCities);
        } else {
          setCities([]);
        }
      } catch (err) {
        console.error("Failed to load location dropdowns", err);
        toast.error("Failed to load location data");
      }
    })();

    return () => {
      mounted = false;
    };
  }, [countryId, stateId]);

  /* -------------------------
     Avatar handlers
     depend on avatar url only (not whole initial object)
  ------------------------- */
  useEffect(() => {
    setAvatar(initial.avatarUrl ?? null);
  }, [initial?.avatarUrl]);

  const onAvatarChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Invalid image file.");
      return;
    }

    // Client-side size check
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error(
        `Image is too large. Maximum allowed: ${MAX_AVATAR_SIZE_MB} MB (${formatBytes(
          MAX_AVATAR_BYTES
        )}). Your file: ${formatBytes(file.size)}.`
      );
      // reset input so user can pick again
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setAvatar(result);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = () => {
    setAvatar(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  /* -------------------------
     Validation
  ------------------------- */
  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!firstName) newErrors.firstName = "Required";
    if (!lastName) newErrors.lastName = "Required";
    if (!email) newErrors.email = "Required";

    // New user: password must; Edit: only when changePassword true
    if (!isEdit || changePassword) {
      if (!password) newErrors.password = "Password required";
      if (password !== confirm) newErrors.confirm = "Does not match";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /* -------------------------
     Save
  ------------------------- */
  const handleSave = async () => {
    if (!validate()) return;

    setSaving(true);
    try {
      // Local AppUser object (UI/local usage)
      const user: AppUser = {
        id: initial.id ?? Date.now(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        address: address.trim(),
        zip: zip.trim(),
        avatarUrl: avatar ?? null,
        countryId: countryId || undefined,
        stateId: stateId || undefined,
        cityId: cityId || undefined,
      };

      // Resolve names from all* arrays (including deleted)
      const countryObj = allCountries.find((c) => c.id === countryId);
      const stateObj = allStates.find((s) => s.id === stateId);
      const cityObj = allCities.find((c) => c.id === cityId);

      const CountryName = countryObj?.name || "";
      const StateName = stateObj?.name || "";
      const CityName = cityObj?.name || "";

      // Duplicate email check - skip when editing and email unchanged
      const initialEmail = (initial.email ?? "").trim();
      const currentEmail = email.trim();

      if (!(isEdit && mongoId && initialEmail.toLowerCase() === currentEmail.toLowerCase())) {
        try {
          await checkDuplicateEmailForUserApi(currentEmail, isEdit && mongoId ? mongoId : undefined);
        } catch (dupErr: any) {
          const message =
            dupErr?.response?.data?.message ??
            dupErr?.message ??
            (dupErr?.body?.message ?? "Email is already registered");
          toast.error(String(message));
          setSaving(false);
          return;
        }
      }

      if (!isEdit) {
        // INSERT
        try {
          await insertUserApi({
            FirstName: firstName.trim(),
            LastName: lastName.trim(),
            EmailID: currentEmail,
            Password: password,
            Address: address.trim(),
            CountryName,
            StateName,
            CityName,
            Zip: zip.trim(),
            AvatarUrl: avatar ?? "",
          } as any);
        } catch (insErr: any) {
          // Enhanced error handling for large payloads
          const status = insErr?.response?.status;
          const serverMsg =
            insErr?.response?.data?.message ??
            insErr?.response?.data?.error ??
            insErr?.message ??
            "Failed to add user";

          if (status === 413 || String(serverMsg).toLowerCase().includes("request entity too large")) {
            toast.error(
              `Image is too large. Maximum allowed: ${MAX_AVATAR_SIZE_MB} MB (${formatBytes(
                MAX_AVATAR_BYTES
              )}).`
            );
          } else if (String(serverMsg).toLowerCase().includes("location upsert failed")) {
            toast.error(
              "Failed to create location (country/state/city) on server. Please check the location values or try again."
            );
          } else {
            toast.error(String(serverMsg));
          }
          console.error("Insert user error:", insErr);
          setSaving(false);
          return;
        }
      } else {
        // UPDATE
        if (!mongoId) {
          throw new Error("UserID missing for update.");
        }

        // Build update payload — DO NOT include Password unless changePassword true
        const updatePayload: any = {
          UserID: String(mongoId),
          FirstName: firstName.trim(),
          LastName: lastName.trim(),
          EmailID: currentEmail,
          Address: address.trim(),
          CountryName,
          StateName,
          CityName,
          Zip: zip.trim(),
          UpdatePassword: !!changePassword,
          AvatarUrl: avatar ?? "",
        };

        if (changePassword) {
          updatePayload.Password = password;
        }

        try {
          await updateUserApi(updatePayload);
        } catch (updErr: any) {
          const status = updErr?.response?.status;
          const serverMsg =
            updErr?.response?.data?.message ??
            updErr?.response?.data?.error ??
            updErr?.message ??
            "Failed to update user";

          if (status === 413 || String(serverMsg).toLowerCase().includes("request entity too large") ||
              String(serverMsg).toLowerCase().includes("request entity too large")) {
            toast.error(
              `Image is too large. Maximum allowed: ${MAX_AVATAR_SIZE_MB} MB (${formatBytes(
                MAX_AVATAR_BYTES
              )}).`
            );
          } else if (String(serverMsg).toLowerCase().includes("location upsert failed")) {
            toast.error(
              "Failed to update location (country/state/city) on server. Please check the location values or try again."
            );
          } else {
            toast.error(String(serverMsg));
          }
          console.error("Update user error:", updErr);
          setSaving(false);
          return;
        }
      }

      // Parent callback
      await onSave(user, (!isEdit || changePassword) ? password : undefined);
      onCancel();
    } catch (err: any) {
      console.error("Unexpected save error:", err);
      const msg = err?.message ?? "An unexpected error occurred";
      toast.error(String(msg));
    } finally {
      setSaving(false);
    }
  };

  /* -------------------------
     Helpers to display deleted labels
  ------------------------- */
  const selectedCountry = allCountries.find((c) => c.id === countryId);
  const selectedState = allStates.find((s) => s.id === stateId);
  const selectedCity = allCities.find((c) => c.id === cityId);

  /* -------------------------
     Avatar click => trigger file input
  ------------------------- */
  const handleAvatarClick = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  return (
    <Box
      className="bg-white p-6 rounded shadow"
      sx={{ maxHeight: "calc(100vh - 180px)", overflowY: "auto" }}
    >
      <Grid container spacing={2}>
        {/* LEFT SIDE */}
        <Grid item xs={12} md={8}>
          <Grid container spacing={2}>
            {/* First Name */}
            <Grid item xs={6}>
              <TextField
                label="First Name *"
                value={firstName}
                fullWidth
                size="small"
                error={!!errors.firstName}
                helperText={errors.firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </Grid>

            {/* Last Name */}
            <Grid item xs={6}>
              <TextField
                label="Last Name *"
                value={lastName}
                fullWidth
                size="small"
                error={!!errors.lastName}
                helperText={errors.lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </Grid>

            {/* Email */}
            <Grid item xs={12}>
              <TextField
                label="Email *"
                value={email}
                fullWidth
                size="small"
                error={!!errors.email}
                helperText={errors.email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Grid>

            {/* Address */}
            <Grid item xs={12}>
              <TextField
                label="Address"
                value={address}
                fullWidth
                size="small"
                onChange={(e) => setAddress(e.target.value)}
              />
            </Grid>

            {/* COUNTRY */}
            <Grid item xs={4}>
              <TextField
                select
                label="Country"
                value={countryId}
                size="small"
                fullWidth
                onChange={(e) => {
                  const val = e.target.value === "" ? "" : String(e.target.value);
                  setCountryId(val);
                  setStateId("");
                  setCityId("");
                }}
                SelectProps={{
                  MenuProps: {
                    PaperProps: {
                      sx: {
                        maxHeight: 48 * 4,
                        overflowY: "auto",
                      },
                    },
                  },
                }}
              >
                <MenuItem value="">Select Country</MenuItem>

                {/* Only ACTIVE countries */}
                {countries.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.name}
                  </MenuItem>
                ))}

                {/* If selected country is deleted */}
                {selectedCountry &&
                  !countries.some((c) => c.id === selectedCountry.id) && (
                    <MenuItem disabled value={selectedCountry.id}>
                      {selectedCountry.name} (deleted)
                    </MenuItem>
                  )}
              </TextField>
            </Grid>

            {/* STATE */}
            <Grid item xs={4}>
              <TextField
                select
                label="State"
                value={stateId}
                size="small"
                fullWidth
                disabled={!countryId}
                onChange={(e) => {
                  const val = e.target.value === "" ? "" : String(e.target.value);
                  setStateId(val);
                  setCityId("");
                }}
                SelectProps={{
                  MenuProps: {
                    PaperProps: {
                      sx: { maxHeight: 48 * 4, overflowY: "auto" },
                    },
                  },
                }}
              >
                <MenuItem value="">Select State</MenuItem>

                {states.map((s) => (
                  <MenuItem key={s.id} value={s.id}>
                    {s.name}
                  </MenuItem>
                ))}

                {selectedState &&
                  !states.some((s) => s.id === selectedState.id) && (
                    <MenuItem disabled value={selectedState.id}>
                      {selectedState.name} (deleted)
                    </MenuItem>
                  )}
              </TextField>
            </Grid>

            {/* CITY */}
            <Grid item xs={4}>
              <TextField
                select
                label="City"
                value={cityId}
                size="small"
                fullWidth
                disabled={!stateId}
                onChange={(e) => setCityId(e.target.value === "" ? "" : String(e.target.value))}
                SelectProps={{
                  MenuProps: {
                    PaperProps: {
                      sx: {
                        maxHeight: 48 * 4,
                        overflowY: "auto",
                      },
                    },
                  },
                }}
              >
                <MenuItem value="">Select City</MenuItem>

                {cities.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.name}
                  </MenuItem>
                ))}

                {selectedCity &&
                  !cities.some((c) => c.id === selectedCity.id) && (
                    <MenuItem disabled value={selectedCity.id}>
                      {selectedCity.name} (deleted)
                    </MenuItem>
                  )}
              </TextField>
            </Grid>

            {/* ZIP */}
            <Grid item xs={6}>
              <TextField
                label="ZIP Code"
                value={zip}
                fullWidth
                size="small"
                onChange={(e) => setZip(e.target.value)}
              />
            </Grid>
          </Grid>
        </Grid>

        {/* RIGHT SIDE — AVATAR */}
        <Grid item xs={12} md={4} className="flex flex-col items-center justify-center">
          {/* container relative so delete & camera icons can overlap */}
          <Box sx={{ position: "relative", display: "inline-block" }}>
            {/* Avatar is clickable: clicking triggers file input */}
            <Tooltip title={avatar ? "Click to change picture" : "Click to upload picture"}>
              <Avatar
                src={avatar || undefined}
                sx={{
                  width: 120,
                  height: 120,
                  cursor: "pointer",
                  position: "relative",
                  zIndex: 1,
                }}
                onClick={handleAvatarClick}
                alt={`${firstName} ${lastName}`.trim() || "avatar"}
              />
            </Tooltip>

            {/* Delete icon underlapping left-top */}
            {avatar && (
              <IconButton
                size="small"
                aria-label="remove avatar"
                onClick={handleRemoveAvatar}
                sx={{
                  position: "absolute",
                  right: -1,
                  top: -1,
                  color: "error.main",
                  zIndex: 0, // under avatar
                }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            )}

            {/* PhotoCamera overlapping button (bottom-right), clickable to open file dialog */}
            <IconButton
              size="small"
              aria-label="upload/change avatar"
              onClick={handleAvatarClick}
              sx={{
                position: "absolute",
                right: -1,
                bottom: -1,
                bgcolor: "background.paper",
                boxShadow: 2,
                zIndex: 2, // above avatar
              }}
            >
              <PhotoCamera fontSize="small" />
            </IconButton>
          </Box>

          {/* Hidden file input for avatar (reused) */}
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            style={{ display: "none" }}
            onChange={onAvatarChange}
          />

          {/* NOTE: Removed the separate "Upload Image" button as requested */}
        </Grid>
      </Grid>

      {/* PASSWORD SECTION */}
      <Box mt={3}>
        {/* If editing: show the checkbox to set/change password (user requested) */}
        {isEdit ? (
          <FormControlLabel
            control={
              <Checkbox
                checked={changePassword}
                onChange={(e) => setChangePassword(e.target.checked)}
              />
            }
            label="Set/Change password"
          />
        ) : null}
      </Box>

      {/* SHOW PASSWORD FIELDS:
          - For Add (isEdit === false): ALWAYS show
          - For Edit (isEdit === true): show only when changePassword === true
      */}
      {( !isEdit || (isEdit && changePassword) ) && (
        <Grid container spacing={2} mt={1}>
          <Grid item xs={6}>
            <TextField
              type="password"
              label="Password *"
              value={password}
              size="small"
              fullWidth
              error={!!errors.password}
              helperText={errors.password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Grid>

          <Grid item xs={6}>
            <TextField
              type="password"
              label="Confirm Password *"
              value={confirm}
              size="small"
              fullWidth
              error={!!errors.confirm}
              helperText={errors.confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </Grid>
        </Grid>
      )}

      {/* BUTTONS */}
      <Box display="flex" justifyContent="flex-end" gap={2} mt={4}>
        <Button variant="outlined" onClick={onCancel}>
          Cancel
        </Button>

        <Button
          variant="contained"
          sx={{ background: "linear-gradient(90deg,#007bff,#0a54c3)" }}
          disabled={saving}
          onClick={handleSave}
        >
          {saving ? "Saving..." : isEdit ? "Save Changes" : "Save User"}
        </Button>
      </Box>
    </Box>
  );
};

export default UserForm;
