// src/components/tasks/TaskFilters.tsx
import React, { useEffect, useState, useCallback } from "react";
import {
  TextField,
  MenuItem,
  IconButton,
  Tooltip,
  Box,
} from "@mui/material";
import {
  FileDownload,
  Refresh,
  GridView,
  ViewList,
  Add as AddIcon,
} from "@mui/icons-material";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { styled } from "@mui/material/styles";

import { getAllUsers } from "../../services/userService";
import tasksApi from "../../api/tasks.api";
import storage from "../../utils/storage";

type Props = {
  search: string;
  setSearch: (v: string) => void;
  status: string;
  setStatus: (v: string) => void;
  priority: string;
  setPriority: (v: string) => void;
  assignedTo: number | string | "";
  setAssignedTo: (v: number | string | "") => void;
  users: { id: number | string; name: string; isDeleted?: boolean }[];
  fromDate: string | "";
  toDate: string | "";
  setFromDate: (v: string | "") => void;
  setToDate: (v: string | "") => void;
  onAdd: () => void;
  onExport: () => void;
  onRefresh: () => void;
  onToggleView: () => void;
  viewMode: "list" | "card";
  onDateRangeFilter?: (from: string, to: string) => void;
};

const StyledDatePicker = styled(DatePicker)(() => ({
  "& .MuiPickersPopper-root": {
    borderRadius: 12,
  },
  "& .MuiPaper-root": {
    borderRadius: 12,
    boxShadow: "0px 8px 24px rgba(0,0,0,0.15)",
    padding: "4px",
  },
  "& .MuiPickersDay-root": {
    fontWeight: 500,
    color: "#0a54c3",
    transition: "all 0.2s ease",
    "&:hover": {
      background: "rgba(10,84,195,0.1)",
      transform: "scale(1.1)",
    },
  },
  "& .Mui-selected": {
    background: "linear-gradient(90deg, #007bff 0%, #0a54c3 100%) !important",
    color: "#fff !important",
    borderRadius: "8px",
  },
  "& .MuiPickersCalendarHeader-label": {
    fontWeight: 600,
    color: "#0a54c3",
  },
  "& .MuiIconButton-root": {
    color: "#0a54c3",
  },
}));

/* Helper: normalize backend user shape to { id, name, isDeleted } */
const normalizeUser = (u: any) => {
  const rawId =
    u.id ?? u._id ?? u.userID ?? u.UserID ?? u.userId ?? u.UserId ?? "";
  const idStr = String(rawId ?? "");
  const name =
    (u.name ??
      `${String(u.firstName ?? "").trim()} ${String(
        u.lastName ?? ""
      ).trim()}`.trim()) ||
    u.email ||
    idStr;

  return {
    id: idStr,
    name,
    isDeleted: !!(u.isDeleted ?? u.IsDeleted),
  };
};

// Helper: derive role from current user object ("admin" / "user" / null)
function deriveRoleFromUser(u: any): string | null {
  if (!u || typeof u !== "object") return null;

  const candidates = [
    u.role,
    u.roleName,
    u.user?.role,
    u.user?.roleName,
    u.userType,
    u.user?.userType,
    u.role?.name,
  ];

  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) {
      return c.trim().toLowerCase();
    }
  }

  const rolesArr =
    (Array.isArray(u.roles) && u.roles.length && u.roles) ||
    (Array.isArray(u.user?.roles) && u.user.roles.length && u.user.roles) ||
    null;

  if (rolesArr) {
    const normalized = rolesArr
      .map((r: any) => (r == null ? "" : String(r).trim().toLowerCase()))
      .filter(Boolean);
    if (normalized.includes("admin")) return "admin";
    if (normalized.length) return normalized[0];
  }

  if (typeof u.isAdmin === "boolean" && u.isAdmin) return "admin";
  if (typeof u.is_superuser === "boolean" && u.is_superuser) return "admin";
  if (typeof u.is_staff === "boolean" && u.is_staff) return "admin";

  if (typeof u.user?.isAdmin === "boolean" && u.user.isAdmin) return "admin";

  return null;
}

const TaskFilters: React.FC<Props> = ({
  search,
  setSearch,
  status,
  setStatus,
  priority,
  setPriority,
  assignedTo,
  setAssignedTo,
  users: usersProp,
  fromDate,
  toDate,
  setFromDate,
  setToDate,
  onAdd,
  onExport,
  onRefresh,
  onToggleView,
  viewMode,
  onDateRangeFilter,
}) => {
  // local users list (string ids) to populate Select
  const [localUsers, setLocalUsers] = useState<
    { id: string; name: string; isDeleted?: boolean }[]
  >([]);
  const [loading, setLoading] = useState(false);

  // current user info (for admin vs user)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [roleDerived, setRoleDerived] = useState<string | null>(null);
  const [hasUser, setHasUser] = useState<boolean | null>(null);

  // load current user once
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        let u: any = null;

        try {
          u = await (storage as any).getCurrentUser();
        } catch {
          u = null;
        }

        if (!u) {
          try {
            u = await (storage as any).fetchCurrentUserFromServer();
          } catch {
            u = null;
          }
        }

        if (!mounted) return;

        if (u) {
          const id =
            u.id ??
            u._id ??
            u.userId ??
            u.userID ??
            (u.user && (u.user.id ?? u.user._id)) ??
            null;
          const role = deriveRoleFromUser(u);
          setCurrentUserId(id ? String(id) : null);
          setRoleDerived(role);
          setHasUser(true);
        } else {
          setCurrentUserId(null);
          setRoleDerived(null);
          setHasUser(false);
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("TaskFilters: failed to load current user", err);
        if (!mounted) return;
        setCurrentUserId(null);
        setRoleDerived(null);
        setHasUser(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      let normalized: { id: string; name: string; isDeleted?: boolean }[] = [];

      const isAdmin = roleDerived === "admin";

      // 🔑 Admin ke liye: tasksApi lookup use karo (all users)
      if (isAdmin) {
        try {
          if (
            (tasksApi as any)?.getAssignedUsersLookup &&
            typeof (tasksApi as any).getAssignedUsersLookup === "function"
          ) {
            const lookup = await (tasksApi as any).getAssignedUsersLookup();
            if (Array.isArray(lookup) && lookup.length > 0) {
              normalized = lookup.map((u: any) =>
                normalizeUser({
                  ...u,
                  id: u.id ?? u._id ?? u._idString,
                })
              );
            }
          }
        } catch (err) {
          // eslint-disable-next-line no-console
          console.debug(
            "TaskFilters: assigned-users lookup failed, falling back to getAllUsers()",
            err
          );
        }
      }

      // 🔑 Normal user (ya agar upar se kuch na mila ho) → getAllUsers()
      // Yaha backend already role-based filter laga chuka hoga
      if (normalized.length === 0) {
        try {
          const all = await getAllUsers();
          if (Array.isArray(all) && all.length > 0) {
            normalized = all.map((u: any) => normalizeUser(u));
          }
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error("TaskFilters: getAllUsers failed", err);
        }
      }

      // 3) final fallback: parent se aayi users list
      if (normalized.length === 0) {
        if (Array.isArray(usersProp) && usersProp.length > 0) {
          normalized = usersProp.map((u) =>
            normalizeUser({ ...u, id: u.id })
          );
        }
      }

      setLocalUsers(normalized);
    } finally {
      setLoading(false);
    }
  }, [usersProp, roleDerived]);

  // parent se users aaye to pehle se dikha do
  useEffect(() => {
    if (Array.isArray(usersProp) && usersProp.length > 0) {
      setLocalUsers(
        usersProp.map((u) => ({
          id: String(u.id),
          name: u.name,
          isDeleted: !!u.isDeleted,
        }))
      );
    }
  }, [usersProp]);

  // Jab role info load ho jaye (hasUser !== null), tab users load karo
  useEffect(() => {
    if (hasUser !== null) {
      loadUsers().catch(() => {});
    }
  }, [loadUsers, hasUser]);

  const handleFullRefresh = () => {
    setSearch("");
    setStatus("");
    setPriority("");
    setAssignedTo("");
    setFromDate("");
    setToDate("");
    onRefresh();
    // reload users as well
    loadUsers().catch(() => {});
  };

  useEffect(() => {
    if (fromDate && toDate && onDateRangeFilter) {
      onDateRangeFilter(fromDate, toDate);
    }
  }, [fromDate, toDate, onDateRangeFilter]);

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid grid-cols-1 sm:grid-cols-7 gap-3 items-center">
          <TextField
            size="small"
            placeholder="Search tasks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <TextField
            label="All Status"
            select
            size="small"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <MenuItem value="">All Status</MenuItem>
            <MenuItem value="complete">Completed</MenuItem>
            <MenuItem value="incomplete">Incomplete</MenuItem>
          </TextField>

          <TextField
            label="All Priority"
            select
            size="small"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          >
            <MenuItem value="">All Priority</MenuItem>
            <MenuItem value="0">Low</MenuItem>
            <MenuItem value="1">Medium</MenuItem>
            <MenuItem value="2">High</MenuItem>
          </TextField>

          <TextField
            label="All Assignees"
            select
            size="small"
            value={assignedTo}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "") {
                setAssignedTo("");
                return;
              }
              const parsed = Number(v);
              setAssignedTo(Number.isFinite(parsed) ? parsed : String(v));
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
            <MenuItem value="">All Assignees</MenuItem>

            {localUsers.map((u) => (
              <MenuItem
                key={u.id}
                value={u.id}
                sx={{
                  opacity: u.isDeleted ? 0.5 : 1,
                  fontStyle: u.isDeleted ? "italic" : "normal",
                  color: u.isDeleted ? "#b91c1c" : "inherit",
                }}
              >
                {u.name} {u.isDeleted ? "(deleted)" : ""}
              </MenuItem>
            ))}

            {localUsers.length === 0 && !loading && (
              <MenuItem value="" disabled>
                No users available
              </MenuItem>
            )}
          </TextField>

          <Box>
            <StyledDatePicker
              label="From Date"
              format="yyyy-MM-dd"
              value={fromDate ? new Date(fromDate) : null}
              onChange={(newValue) =>
                setFromDate(
                  newValue
                    ? new Date(newValue as Date)
                        .toISOString()
                        .split("T")[0]
                    : ""
                )
              }
              slotProps={{
                textField: { size: "small", fullWidth: true },
              }}
            />
          </Box>

          <Box>
            <StyledDatePicker
              label="To Date"
              format="yyyy-MM-dd"
              value={toDate ? new Date(toDate) : null}
              onChange={(newValue) =>
                setToDate(
                  newValue
                    ? new Date(newValue as Date)
                        .toISOString()
                        .split("T")[0]
                    : ""
                )
              }
              slotProps={{
                textField: { size: "small", fullWidth: true },
              }}
            />
          </Box>

          <div className="flex items-center gap-3">
            <Tooltip title="Add new Task">
              <IconButton
                onClick={onAdd}
                sx={{
                  background:
                    "linear-gradient(90deg, #007bff 0%, #0a54c3 100%)",
                  "&:hover": {
                    background:
                      "linear-gradient(90deg, #007bff 0%, #0849ab 100%)",
                  },
                  border: "1px solid #e0e0e0",
                  width: 40,
                  height: 40,
                  boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.2)",
                }}
              >
                <AddIcon sx={{ color: "#fff" }} />
              </IconButton>
            </Tooltip>

            <Tooltip
              title={
                viewMode === "list"
                  ? "Switch to Card View"
                  : "Switch to List View"
              }
            >
              <IconButton
                onClick={onToggleView}
                sx={{ height: 24, width: 24 }}
              >
                {viewMode === "list" ? (
                  <GridView sx={{ color: "#666" }} />
                ) : (
                  <ViewList sx={{ color: "#666" }} />
                )}
              </IconButton>
            </Tooltip>

            <Tooltip title="Export Tasks">
              <IconButton onClick={onExport} sx={{ height: 24, width: 24 }}>
                <FileDownload sx={{ color: "#666" }} />
              </IconButton>
            </Tooltip>

            <Tooltip title="Refresh Tasks">
              <IconButton
                onClick={handleFullRefresh}
                sx={{ height: 24, width: 24 }}
              >
                <Refresh sx={{ color: "#666" }} />
              </IconButton>
            </Tooltip>
          </div>
        </div>
      </div>
    </LocalizationProvider>
  );
};

export default TaskFilters;
