// src/components/users/UserTable.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  IconButton,
  TextField,
  MenuItem,
  Select,
  Tooltip,
  Box,
  Button,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import EditUserDialog from "./EditUserDialog";

import { getCountries } from "../../services/countryService";
import { getStates } from "../../services/stateService";
import { getCities } from "../../services/cityService";

import { AppUser } from "../../utils/storage";
import { getUsersApi, deleteUserApi } from "../../api/userManagementApi";
import apiClient from "../../api/apiClient"; // used for task-check fallback

// Backend row type: AppUser + real MongoDB ID
type UserRow = AppUser & {
  mongoId: string;
};

// Props ab empty (component khud backend se data la raha hai)
type Props = {};

// Normalize helper: anything -> string
const toStr = (v: any) => (v === null || v === undefined ? "" : String(v));

const UserTable: React.FC<Props> = () => {
  // raw backend array (so remapping is easy when location lists change)
  const [usersRaw, setUsersRaw] = useState<any[]>([]);
  // mapped rows for UI
  const [users, setUsers] = useState<UserRow[]>([]);
  const [search, setSearch] = useState("");
  // filter values as strings
  const [country, setCountry] = useState<string>("");
  const [state, setState] = useState<string>("");
  const [city, setCity] = useState<string>("");

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [openEdit, setOpenEdit] = useState(false);

  // Normalize location item types to string ids
  const [countries, setCountries] = useState<{ id: string; name: string }[]>(
    []
  );
  const [states, setStates] = useState<
    { id: string; name: string; countryId?: string }[]
  >([]);
  const [cities, setCities] = useState<
    { id: string; name: string; stateId?: string }[]
  >([]);

  const navigate = useNavigate();

  // Load location dropdown data (from services) and normalize IDs to string
  useEffect(() => {
    (async () => {
      try {
        const rawC = await getCountries();
        const rawS = await getStates();
        const rawCi = await getCities();

        const normC = Array.isArray(rawC)
          ? rawC.map((c: any) => ({
              id: toStr(c.id ?? c._id ?? c.countryID ?? c.countryId ?? ""),
              name: c.name ?? c.countryName ?? "",
            }))
          : [];
        const normS = Array.isArray(rawS)
          ? rawS.map((s: any) => ({
              id: toStr(s.id ?? s._id ?? s.stateID ?? s.stateId ?? ""),
              name: s.name ?? s.stateName ?? "",
              countryId: toStr(s.countryId ?? s.countryID ?? s.country ?? ""),
            }))
          : [];
        const normCi = Array.isArray(rawCi)
          ? rawCi.map((c: any) => ({
              id: toStr(c.id ?? c._id ?? c.cityID ?? c.cityId ?? ""),
              name: c.name ?? c.cityName ?? "",
              stateId: toStr(c.stateId ?? c.stateID ?? c.state ?? ""),
            }))
          : [];

        setCountries(normC);
        setStates(normS);
        setCities(normCi);
      } catch (err) {
        console.error("Failed to load location data:", err);
        toast.error("Failed to load location filters");
      }
    })();
  }, []);

  // Helper: check if user has tasks assigned
  // Tries several common endpoints -- will return true if any task found
  const checkUserHasTasks = async (mongoId: string): Promise<boolean> => {
    if (!mongoId) return false;
    try {
      // 1) try GET /api/Task/GetByUser/{id}
      try {
        const maybe = await apiClient.get(
          `/api/Task/GetByUser/${encodeURIComponent(mongoId)}`
        );
        if (Array.isArray(maybe) && maybe.length > 0) return true;
        if (maybe && typeof maybe === "object") {
          if (Array.isArray((maybe as any).tasks) && (maybe as any).tasks.length > 0)
            return true;
          if (typeof (maybe as any).length === "number" && (maybe as any).length > 0)
            return true;
        }
      } catch (_) {
        // ignore and try fallback
      }

      // 2) try POST /api/Task/GetList with AssignedToUserID filter
      try {
        const payload = { AssignedToUserID: mongoId };
        const listResp = await apiClient.post("/api/Task/GetList", payload);
        if (Array.isArray(listResp) && listResp.length > 0) return true;
        if (listResp && Array.isArray((listResp as any).data) && (listResp as any).data.length > 0)
          return true;
      } catch (_) {
        // ignore; treat as no tasks found by fallback
      }

      return false;
    } catch (err) {
      console.error("checkUserHasTasks error:", err);
      throw err;
    }
  };

  // Load users from backend (raw) — keep raw so mapping can be recomputed later
  const loadUsersRaw = async () => {
    try {
      // backend may accept POST GetList — our api helper handles that
      const list = await getUsersApi();
      setUsersRaw(Array.isArray(list) ? list : []);
    } catch (err: any) {
      console.error("Failed to load users:", err);
      toast.error(err?.message || "Failed to load users");
      setUsersRaw([]);
    }
  };

  // initial load
  useEffect(() => {
    void loadUsersRaw();
  }, []);

  // Recompute mapped users whenever raw users or location lists change.
  // This ensures mapping by country/state/city names works even if locations arrive later.
  useEffect(() => {
    const mapped: UserRow[] = (Array.isArray(usersRaw) ? usersRaw : []).map(
      (u: any, index: number) => {
        const countryName = (u.countryName || "").toLowerCase().trim();
        const stateName = (u.stateName || "").toLowerCase().trim();
        const cityName = (u.cityName || "").toLowerCase().trim();

        const countryObj = countries.find(
          (c) => (c.name || "").toLowerCase().trim() === countryName
        );
        const stateObj = states.find(
          (s) => (s.name || "").toLowerCase().trim() === stateName
        );
        const cityObj = cities.find(
          (c) => (c.name || "").toLowerCase().trim() === cityName
        );

        const row: UserRow = {
          id: index + 1,
          firstName: u.firstName || "",
          lastName: u.lastName || "",
          email: u.emailID || u.email || "",
          address: u.address || "",
          zip: u.zipCode || u.zip || "",
          avatarUrl: u.avatarUrl || u.profileImageUrl || null,
          countryId: countryObj?.id,
          stateId: stateObj?.id,
          cityId: cityObj?.id,
          mongoId: toStr(u.userID ?? u._id ?? u.id ?? ""),
        };

        return row;
      }
    );

    setUsers(mapped);
  }, [usersRaw, countries, states, cities]);

  // Filtered users logic — comparisons are string-safe
  const filtered = useMemo(() => {
    return users.filter((u) => {
      const matchSearch =
        !search ||
        `${u.firstName} ${u.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
        (u.email || "").toLowerCase().includes(search.toLowerCase());

      const matchCountry = !country || toStr(u.countryId) === country;
      const matchState = !state || toStr(u.stateId) === state;
      const matchCity = !city || toStr(u.cityId) === city;

      return matchSearch && matchCountry && matchState && matchCity;
    });
  }, [users, search, country, state, city]);

  const handleEdit = (user: UserRow) => {
    if (!user.mongoId) {
      toast.error("User ID missing for edit");
      return;
    }
    setSelectedUserId(user.mongoId);
    setOpenEdit(true);
  };

  const handleUpdated = () => {
    setOpenEdit(false);
    toast.success("User updated successfully");
    void loadUsersRaw();
  };

  const handleClose = () => setOpenEdit(false);

  // Delete with task-check
  const handleDelete = async (user: UserRow) => {
    if (!user.mongoId) {
      toast.error("User ID missing for delete");
      return;
    }

    try {
      // 1) check tasks
      const hasTasks = await checkUserHasTasks(user.mongoId);
      if (hasTasks) {
        toast.error("User has assigned tasks — cannot delete.");
        return;
      }

      // confirm
      const confirmed = window.confirm(`Delete user ${user.firstName} ${user.lastName}?`);
      if (!confirmed) return;

      // call backend delete
      await deleteUserApi(user.mongoId);

      // optimistic local update: remove from raw + mapped lists
      setUsersRaw((prev) => prev.filter((r) => {
        const rid = toStr(r.userID ?? r._id ?? r.id ?? "");
        return rid !== user.mongoId;
      }));
      toast.success("User deleted");
    } catch (err: any) {
      console.error("Failed to delete user:", err);
      // backend might return structured body with message
      const msg = err?.message || err?.body?.message || "Failed to delete user";
      toast.error(msg);
    }
  };

  // Filter states/cities based on selected parent (string comparison)
  const filteredStates = country ? states.filter((s) => toStr(s.countryId) === country) : states;
  const filteredCities = state ? cities.filter((c) => toStr(c.stateId) === state) : cities;

  return (
    <div className="overflow-x-hidden">
      {/* Filter Bar */}
      <div className="bg-white rounded shadow p-3 flex gap-5 items-center mb-4 flex-wrap">
        <TextField
          sx={{ minWidth: 250 }}
          size="small"
          placeholder="Search users..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {/* Country */}
        <Select
          sx={{ minWidth: 160, fontWeight: "bold" }}
          size="small"
          displayEmpty
          value={country}
          onChange={(e) => {
            const val = toStr((e.target as HTMLInputElement).value);
            setCountry(val);
            setState("");
            setCity("");
          }}
        >
          <MenuItem value="">All Countries</MenuItem>
          {countries.map((c) => (
            <MenuItem key={c.id} value={c.id}>
              {c.name}
            </MenuItem>
          ))}
        </Select>

        {/* State */}
        <Select
          sx={{ minWidth: 160, fontWeight: "bold" }}
          size="small"
          displayEmpty
          value={state}
          onChange={(e) => {
            const val = toStr((e.target as HTMLInputElement).value);
            setState(val);
            setCity("");
          }}
        >
          <MenuItem value="">All States</MenuItem>
          {filteredStates.map((s) => (
            <MenuItem key={s.id} value={s.id}>
              {s.name}
            </MenuItem>
          ))}
        </Select>

        {/* City */}
        <Select
          sx={{ minWidth: 160, fontWeight: "bold" }}
          size="small"
          displayEmpty
          value={city}
          onChange={(e) => setCity(toStr((e.target as HTMLInputElement).value))}
        >
          <MenuItem value="">All Cities</MenuItem>
          {filteredCities.map((c) => (
            <MenuItem key={c.id} value={c.id}>
              {c.name}
            </MenuItem>
          ))}
        </Select>

        {/* Add User */}
        <Button
          variant="contained"
          sx={{
            bgcolor: "#0a54c3",
            "&:hover": { bgcolor: "#083b8f" },
            borderRadius: "8px",
            textTransform: "none",
            marginLeft: "auto",
          }}
          onClick={() => navigate("/users/create")}
        >
          + Add User
        </Button>
      </div>

      {/* Table */}
      <Box
        sx={{
          overflow: "hidden",
          borderRadius: 2,
          boxShadow: "0px 1px 3px rgba(0,0,0,0.1)",
        }}
      >
        <table className="min-w-full bg-white">
          <thead>
            <tr className="text-left text-sm text-gray-600 border-b border-gray-200">
              <th className="p-3">Name</th>
              <th className="p-3">Email</th>
              <th className="p-3">Address</th>
              <th className="p-3">City</th>
              <th className="p-3">Zip</th>
              <th className="p-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr
                key={u.mongoId}
                className="border-t border-gray-200 hover:bg-gray-50"
              >
                <td className="p-3 text-gray-900 text-md font-semibold">
                  <div className="flex items-center gap-3">
                    <img
                      src={
                        u.avatarUrl ||
                        `https://ui-avatars.com/api/?name=${encodeURIComponent(u.firstName + " " + u.lastName)}&background=0a54c3&color=fff`
                      }
                      alt="avatar"
                      className="w-10 h-10 rounded-full"
                    />
                    <div>
                      <div className="text-gray-700 font-medium">
                        {u.firstName} {u.lastName}
                      </div>
                      <div className="text-xs text-gray-500">{u.email}</div>
                    </div>
                  </div>
                </td>
                <td className="p-3 text-sm text-gray-500">{u.email}</td>
                <td className="p-3 text-sm text-gray-500">{u.address}</td>
                <td className="p-3 text-sm text-gray-500">
                  {cities.find((c) => c.id === toStr(u.cityId))?.name || ""},{" "}
                  {states.find((s) => s.id === toStr(u.stateId))?.name || ""},{" "}
                  {countries.find((c) => c.id === toStr(u.countryId))?.name || ""}
                </td>
                <td className="p-3 text-sm text-gray-600">{u.zip}</td>
                <td className="p-3 text-sm text-gray-600 text-center flex justify-center gap-1">
                  <Tooltip title="Edit User" arrow>
                    <IconButton size="small" onClick={() => handleEdit(u)}>
                      <EditIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete User" arrow>
                    <IconButton
                      size="small"
                      onClick={() => handleDelete(u)}
                    >
                      <DeleteIcon color="error" />
                    </IconButton>
                  </Tooltip>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-gray-500 text-sm">
                  No users found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Box>

      {/* Edit Dialog */}
      {openEdit && selectedUserId && (
        <EditUserDialog
          open={openEdit}
          userId={selectedUserId}
          onClose={handleClose}
          onUpdated={handleUpdated}
        />
      )}
    </div>
  );
};

export default UserTable;
