// src/components/profile/ProfileDialog.tsx
import React, { useState, useEffect, ChangeEvent } from "react";
import {
  Dialog,
  DialogContent,
  Avatar,
  TextField,
  Button,
  MenuItem,
  Checkbox,
  FormControlLabel,
  Grid,
  Typography,
  Box,
  IconButton,
  Menu,
  ListItemIcon,
  ListItemText,
} from "@mui/material";

import PhotoCamera from "@mui/icons-material/PhotoCamera";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import { X } from "lucide-react";
import { toast } from "react-toastify";

import { getCountries } from "../../services/countryService";
// namespace import so we can safely use optional exports like getStates()
import * as stateService from "../../services/stateService";
import { getCitiesByState } from "../../services/cityService";

import {
  getCurrentUserApi,
  updateCurrentUserApi,
  checkDuplicateEmailApi,
} from "../../api/userApi"; // ⭐ NEW: backend helpers

import storage from "../../utils/storage"; // fallback (fetchCurrentUserFromServer / getCurrentUser)

type Props = {
  open: boolean;
  onClose: () => void;
};

// Backend se aata model (simplified)
interface CurrentUserModel {
  userID: string;
  firstName: string;
  lastName: string;
  emailID: string;
  address: string;
  countryName: string;
  stateName: string;
  cityName: string;
  zipCode: string;
}

const ProfileDialog: React.FC<Props> = ({ open, onClose }) => {
  // Backend user model
  const [backendUser, setBackendUser] = useState<CurrentUserModel | null>(null);
  const [originalEmail, setOriginalEmail] = useState<string>("");

  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  // Menu for Upload / Remove avatar
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const openMenu = Boolean(anchorEl);

  // Form fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");

  // NOTE: use string consistently for IDs to avoid Select matching issues
  const [countryId, setCountryId] = useState<string | "">("");
  const [stateId, setStateId] = useState<string | "">("");
  const [cityId, setCityId] = useState<string | "">("");

  const [zip, setZip] = useState("");

  const [password, setPassword] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [changePassword, setChangePassword] = useState(false); // UI only (backend change abhi nahi)

  const [updating, setUpdating] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);

  // Dropdown data
  const [countries, setCountries] = useState<any[]>([]);
  const [states, setStates] = useState<any[]>([]);
  const [cities, setCities] = useState<any[]>([]);

  const [profileLoaded, setProfileLoaded] = useState(false);

  // ---------- Country / State / City dropdown data load ----------

  // Countries load once
  useEffect(() => {
    (async () => {
      try {
        const c = await getCountries();
        // normalize country IDs to string for consistent comparisons in UI
        const norm = (c || []).map((x: any) => ({
          ...x,
          id: x.id !== undefined ? String(x.id) : x._id ? String(x._id) : "",
        }));
        setCountries(norm);
      } catch (err) {
        console.error("ProfileDialog: failed to load countries", err);
        toast.error("Failed to load countries");
      }
    })();
  }, []);

  // Helper: fetch all states and filter by country id (safe against differing export shapes)
  const fetchStatesByCountry = async (countryIdNum: number | string) => {
    // prefer an explicit helper if provided
    if (typeof (stateService as any).getStatesByCountry === "function") {
      const param = Number(countryIdNum);
      return await (stateService as any).getStatesByCountry(
        Number.isNaN(param) ? String(countryIdNum) : param
      );
    }

    // otherwise fetch all states and filter client-side
    const allStates: any[] = await (stateService as any).getStates();
    if (!Array.isArray(allStates)) return [];
    return allStates
      .filter((s: any) => {
        const sCountry =
          s.countryId ?? s.countryID ?? s.CountryID ?? s.country ?? "";
        return String(sCountry) === String(countryIdNum);
      })
      .map((s: any) => ({
        ...s,
        id: s.id !== undefined ? String(s.id) : s._id ? String(s._id) : "",
      }));
  };

  // States when countryId change
  useEffect(() => {
    (async () => {
      if (!countryId) {
        setStates([]);
        setStateId("");
        setCities([]);
        setCityId("");
        return;
      }
      try {
        const s = await fetchStatesByCountry(countryId);
        const norm = (s || []).map((st: any) => ({
          ...st,
          id:
            st.id !== undefined ? String(st.id) : st._id ? String(st._id) : "",
        }));
        setStates(norm);
      } catch (err) {
        console.error("ProfileDialog: failed to load states", err);
        toast.error("Failed to load states");
      }
    })();
  }, [countryId]);

  // Cities when stateId change
  useEffect(() => {
    (async () => {
      if (!stateId) {
        setCities([]);
        setCityId("");
        return;
      }
      try {
        const sidParam = String(stateId);
        const cityList = await getCitiesByState(sidParam);
        const norm = (cityList || []).map((ct: any) => ({
          ...ct,
          id:
            ct.id !== undefined ? String(ct.id) : ct._id ? String(ct._id) : "",
        }));
        setCities(norm);
      } catch (err) {
        console.error("ProfileDialog: failed to load cities", err);
        toast.error("Failed to load cities");
      }
    })();
  }, [stateId]);

  // Filter helpers compare string ids
  const filteredStates = states.filter((s) => {
    if (!countryId) return false;
    const sCountry =
      s.countryId ?? s.countryID ?? s.CountryID ?? s.country ?? "";
    return String(sCountry) === String(countryId);
  });
  const filteredCities = cities.filter((c) => {
    if (!stateId) return false;
    const cState = c.stateId ?? c.stateID ?? c.StateID ?? c.state ?? "";
    return String(cState) === String(stateId);
  });

  // ---------- Profile data load from backend on open ----------

  useEffect(() => {
    // when dialog opens, mark profile not loaded
    if (open) setProfileLoaded(false);
  }, [open]);

  useEffect(() => {
    // Load profile when dialog opens and countries are loaded and profile not yet loaded
    if (!open) return;
    if (!countries.length) return;
    if (profileLoaded) return;

    (async () => {
      try {
        setLoadingProfile(true);

        // Attempt primary API call first
        let data: CurrentUserModel | null = null;
        try {
          const apiData = await getCurrentUserApi();
          data = apiData
            ? {
                userID: apiData.userID || "",
                firstName: apiData.firstName || "",
                lastName: apiData.lastName || "",
                emailID: apiData.emailID || "",
                address: apiData.address || "",
                countryName: apiData.countryName || "",
                stateName: apiData.stateName || "",
                cityName: apiData.cityName || "",
                zipCode: apiData.zipCode || "",
              }
            : null;
        } catch (apiErr: any) {
          // If endpoint returns 401/404 or other, fallback to storage which already handles cookie/token
          console.warn(
            "ProfileDialog: getCurrentUserApi failed, falling back to storage.getCurrentUser()",
            apiErr?.status || apiErr
          );
          try {
            const fallback = await storage.getCurrentUser();
            if (fallback) {
              // map fallback to CurrentUserModel shape as best-effort
              data = {
                userID: fallback.id ? String(fallback.id) : "",
                firstName: fallback.firstName || "",
                lastName: fallback.lastName || "",
                emailID: fallback.email || "",
                address: fallback.address || "",
                countryName: fallback.countryId
                  ? String(fallback.countryId)
                  : "",
                stateName: fallback.stateId ? String(fallback.stateId) : "",
                cityName: fallback.cityId ? String(fallback.cityId) : "",
                zipCode: fallback.zip || "",
              } as CurrentUserModel;
            } else {
              // no user found
              console.info("ProfileDialog: no current user found (anonymous).");
              toast.info("You are not signed in.");
              setProfileLoaded(true);
              return;
            }
          } catch (fallbackErr) {
            console.error(
              "ProfileDialog: storage.getCurrentUser() failed",
              fallbackErr
            );
            toast.error("Failed to load profile");
            return;
          }
        }

        if (!data) {
          toast.info("No profile available.");
          setProfileLoaded(true);
          return;
        }

        setBackendUser(data);
        setOriginalEmail(data.emailID || "");

        // Text fields
        setFirstName(data.firstName || "");
        setLastName(data.lastName || "");
        setEmail(data.emailID || "");
        setAddress(data.address || "");
        setZip(data.zipCode || "");

        // Country / State / City name to dropdown IDs mapping (defensive)
        if (data.countryName) {
          const c = countries.find(
            (cc) =>
              String(cc.name).toLowerCase() ===
              String(data.countryName).toLowerCase().trim()
          );
          if (c) {
            setCountryId(String(c.id));

            // fetch states for selected country (using our helper)
            try {
              const sList = await fetchStatesByCountry(String(c.id));
              const normStates = (sList || []).map((st: any) => ({
                ...st,
                id:
                  st.id !== undefined
                    ? String(st.id)
                    : st._id
                    ? String(st._id)
                    : "",
              }));
              setStates(normStates);

              if (data.stateName) {
                const s = normStates.find(
                  (ss: any) =>
                    String(ss.name).toLowerCase() ===
                    String(data.stateName).toLowerCase().trim()
                );
                if (s) {
                  setStateId(String(s.id));

                  try {
                    const cityList = await getCitiesByState(String(s.id));
                    const normCities = (cityList || []).map((ct: any) => ({
                      ...ct,
                      id:
                        ct.id !== undefined
                          ? String(ct.id)
                          : ct._id
                          ? String(ct._id)
                          : "",
                    }));
                    setCities(normCities);

                    if (data.cityName) {
                      const city = normCities.find(
                        (ct: any) =>
                          String(ct.name).toLowerCase() ===
                          String(data.cityName).toLowerCase().trim()
                      );
                      if (city) setCityId(String(city.id));
                    }
                  } catch (cityErr) {
                    console.warn(
                      "ProfileDialog: failed to fetch cities for state:",
                      cityErr
                    );
                  }
                }
              }
            } catch (stateErr) {
              console.warn(
                "ProfileDialog: failed to fetch states for country:",
                stateErr
              );
            }
          }
        }

        setProfileLoaded(true);
      } catch (err: any) {
        console.error("ProfileDialog: failed to load profile", err);
        toast.error(err?.message || "Failed to load profile");
      } finally {
        setLoadingProfile(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, countries, profileLoaded]);

  // ---------- Avatar upload (frontend only abhi) ----------

  const onAvatarChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);
    setAnchorEl(null);
  };

  const handleRemoveAvatar = () => {
    setAvatarPreview(null);
    setAnchorEl(null);
    toast.info("Profile photo removed.");
  };

  // ---------- Validation ----------

  const validateForm = () => {
    if (!firstName.trim() || !lastName.trim()) {
      toast.error("First & Last Name required");
      return false;
    }
    if (!email.trim()) {
      toast.error("Email required");
      return false;
    }
    if (changePassword && password !== confirmPwd) {
      toast.error("Passwords do not match");
      return false;
    }
    // (Password change backend pe abhi implement nahi, sirf UI)
    return true;
  };

  // ---------- Update user ----------

  const handleUpdate = async () => {
    if (!backendUser) {
      toast.error("User not loaded yet");
      return;
    }
    if (!validateForm()) return;

    setUpdating(true);

    try {
      const trimmedEmail = email.trim();

      // Agar email change kiya hai to pehle duplicate check karo
      if (trimmedEmail.toLowerCase() !== (originalEmail || "").toLowerCase()) {
        await checkDuplicateEmailApi(trimmedEmail);
      }

      // Dropdown IDs se names nikaalo (IDs are strings)
      const selectedCountry = countries.find(
        (c) => String(c.id) === String(countryId)
      );
      const selectedState = states.find(
        (s) => String(s.id) === String(stateId)
      );
      const selectedCity = cities.find((c) => String(c.id) === String(cityId));

      const CountryName = selectedCountry?.name || "";
      const StateName = selectedState?.name || "";
      const CityName = selectedCity?.name || "";

      // Backend update payload
      const payload = {
        FirstName: firstName.trim(),
        LastName: lastName.trim(),
        EmailID: trimmedEmail,
        Address: address.trim(),
        CountryName,
        StateName,
        CityName,
        Zip: zip.trim(),
      };

      await updateCurrentUserApi(payload);

     toast.success("Profile updated successfully");

// ✅ 1️⃣ Clear cached user (VERY IMPORTANT)
storage.clearCachedUser();

// ✅ 2️⃣ Ask app to refetch fresh user from server
window.dispatchEvent(new Event("user:update"));

onClose();

    } catch (err: any) {
      console.error("ProfileDialog: update failed", err);
      // if api throws normalized error shape { message, status }
      toast.error(err?.message || "Failed to update profile");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <Dialog
      open={open}
      fullWidth
      maxWidth="md"
      onClose={(e, reason) => {
        if (reason === "backdropClick" || reason === "escapeKeyDown") {
          toast.info("Use Cancel button to close.");
          return;
        }
        onClose();
      }}
    >
      <DialogContent sx={{ p: 0, bgcolor: "#f5f6fa" }}>
        <Box className="bg-white rounded-lg overflow-hidden shadow-md">
          {/* HEADER */}
          <Box
            sx={{
              background: "linear-gradient(90deg, #007bff 0%, #0a54c3 100%)",
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              px: 3,
              py: 3,
            }}
          >
            {/* LEFT */}
            <Box display="flex" alignItems="center" gap={2}>
              <Box textAlign="center">
                <Avatar
                  src={
                    avatarPreview ||
                    `https://ui-avatars.com/api/?name=${firstName}+${lastName}&background=0a54c3&color=fff`
                  }
                  sx={{
                    width: 80,
                    height: 80,
                    border: 3,
                    borderColor: "white",
                    mx: "auto",
                  }}
                />

                <Button
                  variant="text"
                  size="small"
                  startIcon={<EditIcon fontSize="small" />}
                  onClick={(e) => setAnchorEl(e.currentTarget)}
                  sx={{
                    mt: 1,
                    color: "white",
                    textTransform: "none",
                    backgroundColor: "rgba(255,255,255,0.2)",
                  }}
                >
                  Edit Image
                </Button>

                {/* Avatar Menu */}
                <Menu
                  anchorEl={anchorEl}
                  open={openMenu}
                  onClose={() => setAnchorEl(null)}
                >
                  <MenuItem component="label">
                    <ListItemIcon>
                      <PhotoCamera fontSize="small" />
                    </ListItemIcon>
                    <ListItemText primary="Upload Image" />
                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={onAvatarChange}
                    />
                  </MenuItem>

                  {avatarPreview && (
                    <MenuItem onClick={handleRemoveAvatar}>
                      <ListItemIcon>
                        <DeleteIcon fontSize="small" color="error" />
                      </ListItemIcon>
                      <ListItemText primary="Remove Image" />
                    </MenuItem>
                  )}
                </Menu>
              </Box>

              <Box mb={4}>
                <Typography variant="h6" fontWeight={600}>
                  My Profile
                </Typography>
                <Typography variant="body2">
                  Manage your account settings
                </Typography>
              </Box>
            </Box>

            <IconButton onClick={onClose} sx={{ color: "white", mb  : 4 }}>
              <X size={22} />
            </IconButton>
          </Box>

          {/* FORM */}
          <Box sx={{ p: 4 }}>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  label="First Name"
                  fullWidth
                  size="small"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </Grid>

              <Grid item xs={6}>
                <TextField
                  label="Last Name"
                  fullWidth
                  size="small"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  label="Email"
                  type="email"
                  fullWidth
                  size="small"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  label="Address"
                  fullWidth
                  size="small"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </Grid>

              {/* COUNTRY STATE CITY */}
              <Grid item xs={4}>
                <TextField
                  select
                  label="Country"
                  fullWidth
                  size="small"
                  value={countryId}
                  onChange={(e) => {
                    const val =
                      e.target.value === "" ? "" : String(e.target.value);
                    setCountryId(val);
                    setStateId("");
                    setCityId("");
                  }}
                >
                  <MenuItem value="">Select</MenuItem>
                  {countries.map((c: any) => (
                    <MenuItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>

              <Grid item xs={4}>
                <TextField
                  select
                  label="State"
                  fullWidth
                  size="small"
                  disabled={!countryId}
                  value={stateId}
                  onChange={(e) => {
                    const val =
                      e.target.value === "" ? "" : String(e.target.value);
                    setStateId(val);
                    setCityId("");
                  }}
                >
                  <MenuItem value="">Select</MenuItem>
                  {filteredStates.map((s: any) => (
                    <MenuItem key={s.id} value={String(s.id)}>
                      {s.name}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>

              <Grid item xs={4}>
                <TextField
                  select
                  label="City"
                  fullWidth
                  size="small"
                  disabled={!stateId}
                  value={cityId}
                  onChange={(e) => {
                    const val =
                      e.target.value === "" ? "" : String(e.target.value);
                    setCityId(val);
                  }}
                >
                  <MenuItem value="">Select</MenuItem>
                  {filteredCities.map((c: any) => (
                    <MenuItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>

              <Grid item xs={6}>
                <TextField
                  label="Zip Code"
                  fullWidth
                  size="small"
                  value={zip}
                  onChange={(e) => setZip(e.target.value)}
                />
              </Grid>
            </Grid>

            {/* CHANGE PASSWORD */}
            <Box mt={2}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={changePassword}
                    onChange={(e) => setChangePassword(e.target.checked)}
                  />
                }
                label="Change Password"
              />
            </Box>

            {changePassword && (
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField
                    label="New Password"
                    type="password"
                    fullWidth
                    size="small"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </Grid>

                <Grid item xs={6}>
                  <TextField
                    label="Confirm Password"
                    type="password"
                    fullWidth
                    size="small"
                    value={confirmPwd}
                    onChange={(e) => setConfirmPwd(e.target.value)}
                  />
                </Grid>
              </Grid>
            )}

            {/* BUTTONS */}
            <Grid container spacing={2} mt={3}>
              <Grid item xs={6}>
                <Button
                  variant="contained"
                  fullWidth
                  disabled={updating || loadingProfile}
                  sx={{ bgcolor: "#0a54c3" }}
                  onClick={handleUpdate}
                >
                  {updating
                    ? "Updating..."
                    : loadingProfile
                    ? "Loading..."
                    : "Update Profile"}
                </Button>
              </Grid>

              <Grid item xs={6}>
                <Button
                  variant="outlined"
                  fullWidth
                  color="inherit"
                  startIcon={<X size={16} />}
                  onClick={onClose}
                >
                  Cancel
                </Button>
              </Grid>
            </Grid>
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default ProfileDialog;
