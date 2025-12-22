// src/components/tasks/TaskFiltersCard.tsx

import React, { useEffect, useState, useCallback } from "react";
import { TextField, MenuItem, IconButton, Tooltip } from "@mui/material";
import {
  FileDownload,
  Refresh,
  GridView,
  ViewList,
  Add as AddIcon,
} from "@mui/icons-material";

import { getAllUsers } from "../../services/userService";
import tasksApi from "../../api/tasks.api"; // optional fallback to assigned-users lookup (if present)
import storage from "../../utils/storage";

type BackendUser = {
  id: string | number;
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  isDeleted?: boolean;
};

type Props = {
  search: string;
  setSearch: (v: string) => void;
  status: string;
  setStatus: (v: string) => void;
  priority: string;
  setPriority: (v: string) => void;

  assignedTo: string | number | "";
  setAssignedTo: (v: string | "") => void;

  users?: { id: number; name: string; isDeleted?: boolean }[];

  onAdd: () => void;
  onExport: () => void;
  onRefresh: () => void;
  onToggleView: () => void;
  viewMode: "list" | "card";
  setViewMode?: React.Dispatch<React.SetStateAction<"list" | "card">>;
};

const normalizeUser = (u: BackendUser) => {
  const rawId = u.id ?? (u as any)._id ?? (u as any).userID ?? "";
  const idStr = String(rawId ?? "");
  const name =
    (u.name ??
      `${(u.firstName ?? "").toString().trim()} ${(u.lastName ?? "")
        .toString()
        .trim()}`.trim()) ||
    u.email ||
    idStr;
  return { id: idStr, name, isDeleted: !!u.isDeleted };
};

// Helper to sanitize select value
const normalizeSelectValue = (
  val: string | number | "" | null | undefined
): string => {
  if (val === null || val === undefined || val === "" || Number.isNaN(val)) {
    return "";
  }
  return String(val);
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

const TaskFiltersCard: React.FC<Props> = ({
  search,
  setSearch,
  status,
  setStatus,
  priority,
  setPriority,
  assignedTo,
  setAssignedTo,
  users: usersProp,
  onAdd,
  onExport,
  onRefresh,
  onToggleView,
  viewMode,
}) => {
  const [users, setUsers] = useState<
    { id: string; name: string; isDeleted?: boolean }[]
  >([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // current user info (for admin vs user)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [roleDerived, setRoleDerived] = useState<string | null>(null);
  const [hasUser, setHasUser] = useState<boolean | null>(null);

  // load current user once (same pattern as TaskFilters)
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
        console.warn("TaskFiltersCard: failed to load current user", err);
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
    setLoadingUsers(true);
    try {
      let normalized: { id: string; name: string; isDeleted?: boolean }[] = [];

      const isAdmin = roleDerived === "admin";

      // 🔑 Admin ke liye: lightweight lookup endpoint (all users)
      if (isAdmin) {
        try {
          if (
            typeof (tasksApi as any)?.getAssignedUsersLookup === "function"
          ) {
            const lookup = await (tasksApi as any).getAssignedUsersLookup();
            if (Array.isArray(lookup) && lookup.length > 0) {
              normalized = lookup.map((u: any) =>
                normalizeUser({
                  id: u.id ?? u._id ?? u._idString,
                  name: u.name ?? `${u.firstName ?? ""} ${u.lastName ?? ""}`,
                  email: u.email,
                  isDeleted: u.isDeleted,
                })
              );
            }
          }
        } catch (err) {
          // fallback to full users endpoint
          // eslint-disable-next-line no-console
          console.debug(
            "TaskFiltersCard: assigned-users lookup failed, falling back to getAllUsers()",
            err
          );
        }
      }

      // 🔑 Normal user (ya agar admin lookup se kuch nahi mila) → getAllUsers()
      // Yaha backend already role-based filter laga raha hai (sirf self + created users)
      if (normalized.length === 0) {
        try {
          const all = await getAllUsers();
          if (Array.isArray(all) && all.length > 0) {
            normalized = all.map((u: any) => normalizeUser(u));
          }
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error("TaskFiltersCard: getAllUsers() failed", err);
        }
      }

      // 3) fallback to parent-provided users if any
      if (normalized.length === 0) {
        if (Array.isArray(usersProp) && usersProp.length > 0) {
          normalized = usersProp.map((u) => ({
            id: String(u.id),
            name: u.name,
            isDeleted: !!u.isDeleted,
          }));
        }
      }

      setUsers(normalized);
    } finally {
      setLoadingUsers(false);
    }
  }, [usersProp, roleDerived]);

  // initial load & whenever role info ready
  useEffect(() => {
    if (hasUser !== null) {
      loadUsers().catch(() => {});
    }
  }, [loadUsers, hasUser]);

  // Refresh loads users and notifies parent (same behaviour as TaskFilters)
  const handleFullRefresh = async () => {
    try {
      setSearch("");
      setStatus("");
      setPriority("");
      setAssignedTo("");
    } catch {
      // ignore
    }

    await loadUsers();
    try {
      onRefresh?.();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("TaskFiltersCard: onRefresh threw", err);
    }
  };

  // When Select's value changes, we pass string ID (or empty string) to parent wrapper.
  const selectValue = normalizeSelectValue(assignedTo);

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-center">
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
          label="Assigned To"
          select
          size="small"
          value={selectValue}
          onChange={(e) => {
            const v = e.target.value;
            setAssignedTo(v === "" ? "" : String(v));
          }}
        >
          <MenuItem value="">All Assignees</MenuItem>

          {users.map((u) => (
            <MenuItem
              key={u.id}
              value={u.id}
              sx={{
                opacity: u.isDeleted ? 0.55 : 1,
                fontStyle: u.isDeleted ? "italic" : "normal",
                color: u.isDeleted ? "#b91c1c" : "inherit",
              }}
            >
              {u.name} {u.isDeleted ? "(deleted)" : ""}
            </MenuItem>
          ))}

          {users.length === 0 && !loadingUsers && (
            <MenuItem value="" disabled>
              No users available
            </MenuItem>
          )}
        </TextField>

        <div className="flex items-center gap-2 ml-auto">
          <Tooltip title="Add New Task">
            <IconButton
              onClick={onAdd}
              sx={{
                background:
                  "linear-gradient(90deg, #007bff 0%, #0a54c3 100%)",
                "&:hover": {
                  background:
                    "linear-gradient(90deg, #007bff, #0849ab 100%)",
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
              viewMode === "list" ? "Switch to Card View" : "Switch to List View"
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

          <Tooltip title="Refresh Tasks & Users">
            <IconButton
              onClick={handleFullRefresh}
              sx={{ height: 24, width: 24 }}
            >
              <Refresh sx={{ color: "#666" }} />
            </IconButton>
          </Tooltip>
        </div>
      </div>
    </>
  );
};

export default TaskFiltersCard;
