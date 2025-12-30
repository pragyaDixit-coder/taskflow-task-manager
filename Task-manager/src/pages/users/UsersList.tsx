// src/pages/users/UsersList.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  MenuItem,
  Button,
  Box,
  Tooltip,
  IconButton,
  Select,
  InputLabel,
  FormControl,
  Typography,
  Pagination,
  CircularProgress,
} from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";

import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import SearchIcon from "@mui/icons-material/Search";

import { toast } from "react-toastify";

import UserDialog from "./UserDialog";
import ConfirmDeleteDialog from "../../components/common/ConfirmDeleteDialog";

import { getUsersApi, deleteUserApi } from "../../api/userManagementApi";
import { listTasks } from "../../api/tasks.api";

import {
  getCountries,
  getAllCountriesIncludingDeleted,
} from "../../services/countryService";

import {
  getStates,
  getAllStatesIncludingDeleted,
} from "../../services/stateService";

import {
  getCities,
  getAllCitiesIncludingDeleted,
} from "../../services/cityService";

import storage, { AppUser } from "../../utils/storage";

import NoRowsMessage from "../../components/common/NoRowsMessage";

/* -----------------------
   TYPES
------------------------ */

type AppUserStr = Omit<AppUser, "countryId" | "stateId" | "cityId"> & {
  countryId: string;
  stateId: string;
  cityId: string;
};

type UserWithMongoId = AppUserStr & {
  mongoId: string; // backend's actual UserID (string)
  isDeleted?: boolean;
};

type FilterState = {
  country: string;
  state: string;
  city: string;
  search: string;
};

const rowsPerPageOptions = [5, 10, 20];
const DEV_SHOW_ALL_USERS = true;

/* -----------------------
   HELPERS
------------------------ */

function extractUserArray(raw: any): any[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw.items)) return raw.items;
  if (Array.isArray(raw.data)) return raw.data;
  if (Array.isArray(raw.data?.Result)) return raw.data.Result;
  if (Array.isArray(raw.Result)) return raw.Result;
  if (Array.isArray(raw.result)) return raw.result;
  if (Array.isArray(raw.users)) return raw.users;
  if (raw.Result && Array.isArray(raw.Result.items)) return raw.Result.items;
  if (raw.result && Array.isArray(raw.result.items)) return raw.result.items;
  if (typeof raw === "object" && Object.keys(raw).length > 0) return [raw];
  return [];
}

function mapToUserWithMongoId(
  u: any,
  index: number,
  safeActiveCountries: any[],
  safeActiveStates: any[],
  safeActiveCities: any[]
): UserWithMongoId {
  const countryName = String(u.countryName ?? u.CountryName ?? "")
    .toLowerCase()
    .trim();
  const stateName = String(u.stateName ?? u.StateName ?? "")
    .toLowerCase()
    .trim();
  const cityName = String(u.cityName ?? u.CityName ?? "")
    .toLowerCase()
    .trim();

  const countryObj = safeActiveCountries.find(
    (c: any) =>
      String(c.name ?? c.Name ?? c.countryName ?? "")
        .toLowerCase()
        .trim() === countryName
  );
  const stateObj = safeActiveStates.find(
    (s: any) =>
      String(s.name ?? s.Name ?? s.stateName ?? "")
        .toLowerCase()
        .trim() === stateName
  );
  const cityObj = safeActiveCities.find(
    (c: any) =>
      String(c.name ?? c.Name ?? c.cityName ?? "")
        .toLowerCase()
        .trim() === cityName
  );

  const createdById =
    u.createdById ?? u.CreatedById ?? u.createdBy ?? u.CreatedBy ?? null;

  const isDeletedFlag =
    Boolean(u.isDeleted ?? u.IsDeleted ?? u.deleted ?? u.is_deleted) ||
    Boolean(u.deletedAt) ||
    (typeof u.active === "boolean" && u.active === false);

  const mapped: UserWithMongoId = {
    id: index + 1,
    firstName: u.firstName ?? u.FirstName ?? u.first ?? "",
    lastName: u.lastName ?? u.LastName ?? u.last ?? "",
    email: u.emailID ?? u.email ?? u.EmailID ?? u.Email ?? "",
    address: u.address ?? u.Address ?? u.addressLine ?? "",
    countryId: countryObj
      ? String(
          (countryObj as any).id ??
            (countryObj as any)._id ??
            (countryObj as any).countryID ??
            ""
        )
      : String(u.countryId ?? u.CountryID ?? u.countryID ?? u.CountryID ?? ""),
    stateId: stateObj
      ? String(
          (stateObj as any).id ??
            (stateObj as any)._id ??
            (stateObj as any).stateID ??
            ""
        )
      : String(u.stateId ?? u.StateID ?? u.stateID ?? u.StateID ?? ""),
    cityId: cityObj
      ? String(
          (cityObj as any).id ??
            (cityObj as any)._id ??
            (cityObj as any).cityID ??
            ""
        )
      : String(u.cityId ?? u.CityID ?? u.cityID ?? u.CityID ?? ""),
    zip: u.zipCode ?? u.ZipCode ?? u.zip ?? u.Zip ?? "",
    avatarUrl: u.avatarUrl ?? u.AvatarUrl ?? u.profileImageUrl ?? null,
    createdById,
    mongoId: String(u.userID ?? u.UserID ?? u._id ?? u.id ?? u._id ?? ""),
    isDeleted: isDeletedFlag,
  };

  return mapped;
}

/** check if task actually refers to mongoId */
function taskBelongsToUser(task: any, mongoId: string): boolean {
  if (!task) return false;
  const idStr = String(mongoId);

  const assignedToIds = task.assignedToIds ?? task.AssignedToIds ?? null;
  if (Array.isArray(assignedToIds)) {
    if (assignedToIds.some((v: any) => String(v) === idStr)) return true;
  }

  const assignedTo = task.assignedTo ?? task.AssignedTo ?? null;
  if (Array.isArray(assignedTo)) {
    if (assignedTo.some((v: any) => String(v) === idStr)) return true;
  }

  const taskAssigned =
    task.TaskAssignedUser ??
    task.TaskAssignedUsers ??
    task.AssignedUsers ??
    null;
  if (Array.isArray(taskAssigned)) {
    for (const obj of taskAssigned) {
      const candidate =
        obj?.AssignedUserID ??
        obj?.assignedUserId ??
        obj?.id ??
        obj?._id ??
        null;
      if (candidate != null && String(candidate) === idStr) return true;
    }
  }

  const singleAssigned =
    task.AssignedTo ?? task.assignedTo ?? task.Assigned ?? null;
  if (singleAssigned != null) {
    if (typeof singleAssigned === "string") {
      if (singleAssigned === idStr) return true;
      try {
        const parsed = JSON.parse(singleAssigned);
        if (Array.isArray(parsed) && parsed.some((v) => String(v) === idStr))
          return true;
        if (String(parsed) === idStr) return true;
      } catch {
        // ignore parse errors
      }
    } else if (String(singleAssigned) === idStr) return true;
  }

  const otherCandidate =
    task.AssignedUserId ??
    task.assignedUserId ??
    task.AssignedUser ??
    task.assignedUser ??
    null;
  if (otherCandidate != null && String(otherCandidate) === idStr) return true;

  return false;
}

/* -----------------------
   COMPONENT
------------------------ */

const UsersList: React.FC = () => {
  const [users, setUsers] = useState<UserWithMongoId[]>([]);
  const [filtered, setFiltered] = useState<UserWithMongoId[]>([]);

  const [filters, setFilters] = useState<FilterState>({
    country: "",
    state: "",
    city: "",
    search: "",
  });

  const [openDialog, setOpenDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithMongoId | null>(
    null
  );

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [recentDeletedIds, setRecentDeletedIds] = useState<string[]>([]);

  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState<number>(5);

  const [countries, setCountries] = useState<any[]>([]);
  const [states, setStates] = useState<any[]>([]);
  const [cities, setCities] = useState<any[]>([]);

  const [allCountries, setAllCountries] = useState<any[]>([]);
  const [allStates, setAllStates] = useState<any[]>([]);
  const [allCities, setAllCities] = useState<any[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);

  useEffect(() => {
    let mounted = true;

    const loadAllData = async () => {
      setLoading(true);
      try {
        const [
          userListFromApi,
          activeCountries,
          activeStates,
          activeCities,
          allCountriesFull,
          allStatesFull,
          allCitiesFull,
          currentUser,
        ] = await Promise.all([
          (async () => {
            try {
              return await getUsersApi();
            } catch (e) {
              console.error("getUsersApi failed:", e);
              return [];
            }
          })(),
          (async () => {
            try {
              return await getCountries();
            } catch (e) {
              console.error("getCountries failed:", e);
              return [];
            }
          })(),
          (async () => {
            try {
              return await getStates();
            } catch (e) {
              console.error("getStates failed:", e);
              return [];
            }
          })(),
          (async () => {
            try {
              return await getCities();
            } catch (e) {
              console.error("getCities failed:", e);
              return [];
            }
          })(),
          (async () => {
            try {
              return await getAllCountriesIncludingDeleted();
            } catch (e) {
              console.warn("getAllCountriesIncludingDeleted failed:", e);
              return [];
            }
          })(),
          (async () => {
            try {
              return await getAllStatesIncludingDeleted();
            } catch (e) {
              console.warn("getAllStatesIncludingDeleted failed:", e);
              return [];
            }
          })(),
          (async () => {
            try {
              return await getAllCitiesIncludingDeleted();
            } catch (e) {
              console.warn("getAllCitiesIncludingDeleted failed:", e);
              return [];
            }
          })(),
          (async () => {
            try {
              return await storage.getCurrentUser();
            } catch (e) {
              console.warn("storage.getCurrentUser failed:", e);
              return null;
            }
          })(),
        ]);

        if (!mounted) return;

        const safeActiveCountries = Array.isArray(activeCountries)
          ? activeCountries
          : [];
        const safeActiveStates = Array.isArray(activeStates)
          ? activeStates
          : [];
        const safeActiveCities = Array.isArray(activeCities)
          ? activeCities
          : [];

        const safeAllCountries = Array.isArray(allCountriesFull)
          ? allCountriesFull
          : [];
        const safeAllStates = Array.isArray(allStatesFull) ? allStatesFull : [];
        const safeAllCities = Array.isArray(allCitiesFull) ? allCitiesFull : [];

        setCountries(safeActiveCountries);
        setStates(safeActiveStates);
        setCities(safeActiveCities);

        setAllCountries(safeAllCountries);
        setAllStates(safeAllStates);
        setAllCities(safeAllCities);

        // extract users robustly
        const apiList: any[] = extractUserArray(userListFromApi);

        const mappedUsers: UserWithMongoId[] = apiList.map(
          (u: any, index: number) =>
            mapToUserWithMongoId(
              u,
              index,
              safeActiveCountries,
              safeActiveStates,
              safeActiveCities
            )
        );

        // Filter out deleted by flag OR by recentDeletedIds (if present)
        const visibleAfterDeleteFilter = mappedUsers.filter((mu) => {
          if (mu.isDeleted) return false;
          if (
            recentDeletedIds &&
            recentDeletedIds.length > 0 &&
            recentDeletedIds.includes(String(mu.mongoId))
          )
            return false;
          return true;
        });

        const role = currentUser?.role
          ? String(currentUser.role).toLowerCase()
          : null;
        const currentUserId = currentUser?._id ?? currentUser?.id ?? null;

        const visibleUsers = DEV_SHOW_ALL_USERS
          ? visibleAfterDeleteFilter
          : role === "admin"
          ? visibleAfterDeleteFilter
          : visibleAfterDeleteFilter.filter((u) => {
              if (!currentUserId) return false;
              // 👇 allow self
              if (String(u.mongoId) === String(currentUserId)) return true;
              return String(u.createdById) === String(currentUserId);
            });

        setUsers(visibleUsers);
      } catch (err) {
        console.error("Failed loading users / location lists:", err);
        toast.error("Failed to load data");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void loadAllData();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recentDeletedIds]);

  useEffect(() => {
    let out = [...users];

    const q = filters.search.trim().toLowerCase();
    if (q.length > 0) {
      out = out.filter(
        (u) =>
          `${u.firstName} ${u.lastName}`.toLowerCase().includes(q) ||
          (u.email || "").toLowerCase().includes(q)
      );
    }

    if (filters.country !== "")
      out = out.filter((u) => String(u.countryId) === String(filters.country));
    if (filters.state !== "")
      out = out.filter((u) => String(u.stateId) === String(filters.state));
    if (filters.city !== "")
      out = out.filter((u) => String(u.cityId) === String(filters.city));

    setFiltered(out);
    setPage(1);
  }, [filters, users]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / rowsPerPage));
  const startIndex = (page - 1) * rowsPerPage;
  const endIndex = Math.min(startIndex + rowsPerPage, total);
  const pageItems = filtered.slice(startIndex, endIndex);

  const handleEdit = (u: UserWithMongoId) => {
    setSelectedUser(u);
    setOpenDialog(true);
  };

  const reloadUsersAndSetState = async () => {
    const userListFromApi = await getUsersApi();
    console.log("👀 RAW user list from API 👉", userListFromApi);
    const apiList: any[] = extractUserArray(userListFromApi);
    // eslint-disable-next-line no-console
    console.debug("[UsersList] reloadUsers apiList length:", apiList.length);

    const safeActiveCountries = Array.isArray(countries) ? countries : [];
    const safeActiveStates = Array.isArray(states) ? states : [];
    const safeActiveCities = Array.isArray(cities) ? cities : [];

    const mappedUsers: UserWithMongoId[] = apiList.map(
      (u: any, index: number) =>
        mapToUserWithMongoId(
          u,
          index,
          safeActiveCountries,
          safeActiveStates,
          safeActiveCities
        )
    );

    const visibleAfterDeleteFilter = mappedUsers.filter((mu) => {
      if (mu.isDeleted) return false;
      if (
        recentDeletedIds &&
        recentDeletedIds.length > 0 &&
        recentDeletedIds.includes(String(mu.mongoId))
      )
        return false;
      return true;
    });

    const currentUser = await storage.getCurrentUser();
    const role = currentUser?.role
      ? String(currentUser.role).toLowerCase()
      : null;
    const currentUserId = currentUser?._id ?? currentUser?.id ?? null;

    const visibleUsers = DEV_SHOW_ALL_USERS
      ? visibleAfterDeleteFilter
      : role === "admin"
      ? visibleAfterDeleteFilter
      : visibleAfterDeleteFilter.filter((u) => {
          if (!currentUserId) return false;
          // 👇 allow self
          if (String(u.mongoId) === String(currentUserId)) return true;
          return String(u.createdById) === String(currentUserId);
        });

    setUsers(visibleUsers);
  };

  const handleSaved = async () => {
    setOpenDialog(false);
    setSaving(true);
    try {
      await reloadUsersAndSetState();
      toast.success("User saved successfully");
    } catch (err) {
      console.error("Reload after save failed:", err);
      toast.error("Failed to reload users after save");
    } finally {
      setSaving(false);
    }
  };

  /**
   * FIXED handleDelete:
   * - If user has assigned tasks -> show error toast immediately and DO NOT open confirm.
   * - If user has no tasks -> open confirm
   */
  const handleDelete = async (mongoId: string) => {
    try {
      // Call tasks API with assignedTo filter (backend may support this filter)
      const resp = await listTasks({
        page: 1,
        limit: 50,
        filters: { assignedTo: String(mongoId) },
      });

      // Normalize to items array
      let items: any[] = [];
      if (!resp) items = [];
      else if (Array.isArray((resp as any).items)) items = (resp as any).items;
      else if (Array.isArray((resp as any).data)) items = (resp as any).data;
      else if (Array.isArray((resp as any).rows)) items = (resp as any).rows;
      else if (Array.isArray((resp as any).result))
        items = (resp as any).result;
      else if (Array.isArray(resp)) items = resp as any[];
      else items = [];

      // Filter tasks that truly reference the mongoId
      const trulyAssigned = items.filter((t) => taskBelongsToUser(t, mongoId));

      if (trulyAssigned.length > 0) {
        // User has tasks -> show error toast immediately and prevent confirm dialog
        toast.error("User can't be deleted — user has assigned tasks", {
          autoClose: 5000,
        });
        return;
      }

      // No tasks -> open confirm dialog
      setDeletingUserId(mongoId);
      setConfirmOpen(true);
    } catch (err) {
      // If tasks check fails, DO NOT open confirm. Show error so user can retry.
      console.warn("Failed to verify assigned tasks:", err);
      toast.error("Failed to verify assigned tasks. Please try again.", {
        autoClose: 5000,
      });
      return;
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingUserId) return;

    try {
      setDeleting(true);

      // Final double-check (safe)
      try {
        const finalResp = await listTasks({
          page: 1,
          limit: 50,
          filters: { assignedTo: String(deletingUserId) },
        });

        let finalItems: any[] = [];
        if (!finalResp) finalItems = [];
        else if (Array.isArray((finalResp as any).items))
          finalItems = (finalResp as any).items;
        else if (Array.isArray((finalResp as any).data))
          finalItems = (finalResp as any).data;
        else if (Array.isArray((finalResp as any).rows))
          finalItems = (finalResp as any).rows;
        else if (Array.isArray((finalResp as any).result))
          finalItems = (finalResp as any).result;
        else if (Array.isArray(finalResp)) finalItems = finalResp as any[];
        else finalItems = [];

        const finalAssigned = finalItems.filter((t) =>
          taskBelongsToUser(t, deletingUserId)
        );
        if (finalAssigned.length > 0) {
          toast.error("User can't be deleted — user has assigned tasks", {
            autoClose: 5000,
          });
          setConfirmOpen(false);
          setDeleting(false);
          setDeletingUserId(null);
          return;
        }
      } catch (e) {
        console.warn("Final task verification failed:", e);
        toast.error("Failed to verify assigned tasks. Delete aborted.", {
          autoClose: 5000,
        });
        setConfirmOpen(false);
        setDeleting(false);
        setDeletingUserId(null);
        return;
      }

      // perform delete
      await deleteUserApi(deletingUserId);

      // persist recently deleted id so server returning deleted items won't re-show them immediately
      setRecentDeletedIds((prev) =>
        Array.from(new Set([...prev, String(deletingUserId)]))
      );

      // remove locally for instant feedback
      setUsers((prev) =>
        prev.filter((u) => String(u.mongoId) !== String(deletingUserId))
      );
      setFiltered((prev) =>
        prev.filter((u) => String(u.mongoId) !== String(deletingUserId))
      );

      // reload from backend to be safe
      await reloadUsersAndSetState();

      toast.success("User deleted");
      setConfirmOpen(false);
      setDeletingUserId(null);
      setPage(1);
    } catch (err: any) {
      console.error("Failed to delete user:", err);
      const msg =
        (err &&
          (err.body?.message ||
            err.body?.msg ||
            err.message ||
            err.toString())) ??
        "Failed to delete user";
      if (typeof msg === "string" && /assign(ed)? tasks?/i.test(msg)) {
        toast.error("User can't be deleted — user has assigned tasks", {
          autoClose: 5000,
        });
      } else {
        toast.error(msg, { autoClose: 5000 });
      }
      setConfirmOpen(false);
      setDeletingUserId(null);
    } finally {
      setDeleting(false);
    }
  };

  const clearFilters = () => {
    setFilters({ country: "", state: "", city: "", search: "" });
  };

  const label = (item: any) =>
    item ? (item.isDeleted ? `${item.name}` : item.name) : "";

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <CircularProgress />
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* HEADER */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-3xl font-semibold">Users</h2>

        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => {
            setSelectedUser(null);
            setOpenDialog(true);
          }}
          sx={{
            background: "linear-gradient(90deg,#007bff,#0a54c3)",
            "&:hover": {
              background: "linear-gradient(90deg,#007bff,#0849ab)",
            },
          }}
        >
          Add User
        </Button>
      </div>

      {/* FILTERS */}
      <div className="bg-white rounded-lg shadow p-4 mb-5">
        <div className="flex flex-wrap items-center gap-5">
          {/* SEARCH */}
          <Box
            className="flex items-center border border-gray-300 rounded px-2"
            sx={{ minWidth: 400 }}
          >
            <SearchIcon className="text-gray-400 mr-2" />
            <input
              placeholder="Search users..."
              value={filters.search}
              onChange={(e) =>
                setFilters({ ...filters, search: e.target.value })
              }
              className="outline-none p-2 w-full text-sm"
            />
          </Box>

          {/* COUNTRY */}
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>All Countries</InputLabel>
            <Select
              label="All Countries"
              value={filters.country}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  country: e.target.value === "" ? "" : String(e.target.value),
                })
              }
              MenuProps={{
                PaperProps: {
                  sx: {
                    maxHeight: 48 * 4,
                    overflowY: "auto",
                  },
                },
              }}
            >
              <MenuItem value="">All Countries</MenuItem>
              {countries.map((c) => (
                <MenuItem
                  key={String(
                    (c as any).id ?? (c as any)._id ?? (c as any).countryID
                  )}
                  value={String(
                    (c as any).id ?? (c as any)._id ?? (c as any).countryID
                  )}
                >
                  {(c as any).name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* STATE */}
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>All States</InputLabel>
            <Select
              label="All States"
              value={filters.state}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  state: e.target.value === "" ? "" : String(e.target.value),
              })
              }
              MenuProps={{
                PaperProps: {
                  sx: { maxHeight: 48 * 4, overflowY: "auto" },
                },
              }}
            >
              <MenuItem value="">All States</MenuItem>

              {states.map((s) => (
                <MenuItem
                  key={String(
                    (s as any).id ?? (s as any)._id ?? (s as any).stateID
                  )}
                  value={String(
                    (s as any).id ?? (s as any)._id ?? (s as any).stateID
                  )}
                >
                  {(s as any).name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* CITY */}
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>All Cities</InputLabel>
            <Select
              label="All Cities"
              value={filters.city}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  city: e.target.value === "" ? "" : String(e.target.value),
                })
              }
              MenuProps={{
                PaperProps: {
                  sx: { maxHeight: 48 * 4, overflowY: "auto" },
                },
              }}
            >
              <MenuItem value="">All Cities</MenuItem>
              {cities.map((c) => (
                <MenuItem
                  key={String(
                    (c as any).id ?? (c as any)._id ?? (c as any).cityID
                  )}
                  value={String(
                    (c as any).id ?? (c as any)._id ?? (c as any).cityID
                  )}
                >
                  {(c as any).name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Button
            onClick={clearFilters}
            size="medium"
            sx={{ fontWeight: "800", ml: "auto", maxWidth: 150 }}
          >
            Clear Filter
          </Button>
        </div>
      </div>

      {/* TABLE */}
      <Box
        sx={{
          minHeight: "200px", // 👈 kam data par chhota rahe
          maxHeight: "60vh", // 👈 zyada data par limit
          overflow: "auto", // 👈 scroll yahin aaye
          backgroundColor: "#fff",
          borderRadius: 2,
          boxShadow: 1,
        }}
      >
        <DataGrid
          rows={filtered} // 🔑 SAME pagination logic
          getRowId={(row) => row.mongoId}
          hideFooter // ❌ pagination footer gone
          disableRowSelectionOnClick
          rowHeight={72}
          slots={{
            noRowsOverlay: () => <NoRowsMessage message="No users found" />,
          }}
          columns={[
            {
              field: "name",
              headerName: "Name",
              flex: 1,
              renderCell: (p) => (
                <Box className="flex items-center gap-3">
                  <img
                    src={
                      p.row.avatarUrl ||
                      `https://ui-avatars.com/api/?name=${encodeURIComponent(
                        p.row.firstName + " " + p.row.lastName
                      )}&background=0a54c3&color=fff`
                    }
                    className="w-10 h-10 rounded-full"
                  />
                  <span style={{ fontWeight: 600, color: "#1f2937" }}>
                    {p.row.firstName} {p.row.lastName}
                  </span>
                </Box>
              ),
            },
            {
              field: "email",
              headerName: "Email",
              flex: 1,
              renderCell: (p) => (
                <span style={{ color: "#6b7280" }}>{p.row.email}</span>
              ),
            },
            {
              field: "address",
              headerName: "Address",
              flex: 1,
              renderCell: (p) => (
                <span style={{ color: "#6b7280" }}>{p.row.address}</span>
              ),
            },
            {
              field: "location",
              headerName: "Location",
              flex: 1,
              renderCell: (p) => {
                const city = allCities.find(
                  (c) => String(c.id) === p.row.cityId
                );
                const state = allStates.find(
                  (s) => String(s.id) === p.row.stateId
                );
                const country = allCountries.find(
                  (c) => String(c.id) === p.row.countryId
                );
                return (
                  <span style={{ color: "#6b7280" }}>
                    {[city?.name, state?.name, country?.name]
                      .filter(Boolean)
                      .join(", ")}
                  </span>
                );
              },
            },
            {
              field: "zip",
              headerName: "Zip",
              width: 120,
              align: "center",
              headerAlign: "center",
              renderCell: (p) => (
                <span style={{ color: "#6b7280" }}>{p.row.zip}</span>
              ),
            },
            {
              field: "actions",
              headerName: "Actions",
              width: 140,
              sortable: false,
              align: "right",
              headerAlign: "right",
              renderCell: (p) => (
                <>
                  <Tooltip title="Edit User">
                    <IconButton size="small" onClick={() => handleEdit(p.row)}>
                      <EditIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete User">
                    <IconButton
                      size="small"
                      onClick={() => handleDelete(p.row.mongoId)}
                    >
                      <DeleteIcon color="error" />
                    </IconButton>
                  </Tooltip>
                </>
              ),
            },
          ]}
          sx={{
            border: "none",
            p: 2,
            "& .MuiDataGrid-footerContainer": { display: "none" },
            "& .MuiDataGrid-filler": { display: "none" },
            "& .MuiDataGrid-scrollbarFiller": { display: "none" },
            "& .MuiDataGrid-cell": {
              fontSize: "0.945rem",
              color: "#6b7280",
            },
            "& .MuiDataGrid-columnHeaders": {
              backgroundColor: "#f9fafb",
              fontWeight: 500,
              fontSize: "1rem",
              color: "#6b7280",
            },
            "& .MuiDataGrid-columnHeaderTitle": {
              fontWeight: 600,
              fontSize: "1rem",
            },
          }}
        />
      </Box>

      {/* PAGINATION */}

      {/* ADD/EDIT USER */}
      {openDialog && (
        <UserDialog
          open={openDialog}
          onClose={() => setOpenDialog(false)}
          onSaved={handleSaved}
          initial={selectedUser || undefined}
        />
      )}

      {/* DELETE CONFIRM */}
      <ConfirmDeleteDialog
        open={confirmOpen}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Delete User?"
        message="Are you sure you want to delete this user?"
        loading={deleting}
      />
    </div>
  );
};

export default UsersList;
