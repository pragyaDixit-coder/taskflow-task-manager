// src/components/layout/Header.tsx
import React, { useState, useEffect, useCallback } from "react";
import { Search, Bell } from "lucide-react";
import {
  Menu,
  MenuItem,
  IconButton,
  Avatar,
  Box,
  Popper,
  Paper,
  List,
  ListItemButton,
  ListItemText,
  CircularProgress,
  Tooltip,
  ClickAwayListener,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import {
  getCurrentUser,
  clearCachedUser,
  removeToken,
  logout as storageLogout,
} from "../../utils/storage";
import { getTasks } from "../../services/taskService";
import { getAllUsers } from "../../services/userService";
import ProfileDialog from "../../pages/users/Profile";

type Role = "admin" | "user";

type SearchResult = {
  id: number | string;
  label: string;
  type: "task" | "user";
};

const Header: React.FC = () => {
  const navigate = useNavigate();

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>("User");
  const [role, setRole] = useState<Role>("user");
  const [currentUserId, setCurrentUserId] = useState<string>("");

  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [popperAnchor, setPopperAnchor] = useState<HTMLElement | null>(null);
  const [openProfile, setOpenProfile] = useState(false);

  // 🔹 Load current user info
  const refreshUserInfo = useCallback(async () => {
    try {
      const u = await getCurrentUser();
      if (!u) return;

      setRole(u.role?.toLowerCase() === "admin" ? "admin" : "user");
      setCurrentUserId(String(u.id));

      const first = u.firstName?.trim();
      const last = u.lastName?.trim();
      const name =
        first || last ? `${first || ""} ${last || ""}`.trim() : "User";

      setUserName(name);

      const fallbackAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(
        name
      )}&background=0a54c3&color=fff`;

      setAvatarUrl(u.avatarUrl ?? fallbackAvatar);
    } catch (err) {
      console.error("Failed to refresh user info:", err);
    }
  }, []);

  useEffect(() => {
    refreshUserInfo();

    const onUserUpdate = () => refreshUserInfo();
    window.addEventListener("user:update", onUserUpdate as EventListener);

    return () => {
      window.removeEventListener("user:update", onUserUpdate as EventListener);
    };
  }, [refreshUserInfo]);

  // 🔍 SEARCH EFFECT (TASK + USER FIXED)
  useEffect(() => {
    const runSearch = async () => {
      if (!search.trim()) {
        setResults([]);
        return;
      }

      setLoading(true);
      try {
        const lowered = search.toLowerCase();

        const [taskRes, users] = await Promise.all([
          getTasks(),
          getAllUsers(),
        ]);

        // ✅ IMPORTANT FIX: extract actual task array
        const tasks = Array.isArray(taskRes)
          ? taskRes
          : taskRes?.items ?? [];

        // ---- TASK SEARCH
        const taskResults: SearchResult[] = tasks
          .filter((t: any) => {
            const match =
              t.name?.toLowerCase().includes(lowered) ||
              t.descriptionPlain?.toLowerCase().includes(lowered);

            if (!match) return false;

            if (role === "user") {
              const createdById =
                typeof t.createdBy === "object"
                  ? String(t.createdBy?.id)
                  : String(t.createdBy);

              const assignedIds = Array.isArray(t.assignedTo)
                ? t.assignedTo.map((a: any) =>
                    typeof a === "object" ? String(a.id) : String(a)
                  )
                : [];

              return (
                createdById === currentUserId ||
                assignedIds.includes(currentUserId)
              );
            }

            return true; // admin
          })
          .map((t: any) => ({
            id: t.id,
            label: `Task: ${t.name}`,
            type: "task",
          }));

        // ---- USER SEARCH
        const userResults: SearchResult[] = Array.isArray(users)
          ? users
              .filter((u: any) => {
                const name = `${u.firstName || ""} ${u.lastName || ""}`
                  .toLowerCase();

                if (!name.includes(lowered)) return false;

                if (role === "user") {
                  const createdById =
                    typeof u.createdBy === "object"
                      ? String(u.createdBy?.id)
                      : String(u.createdBy);
                  return createdById === currentUserId;
                }

                return true; // admin
              })
              .map((u: any) => ({
                id: u.id,
                label: `User: ${u.firstName || ""} ${u.lastName || ""}`,
                type: "user",
              }))
          : [];

        setResults([...taskResults, ...userResults]);
      } catch (err) {
        console.error("Search failed:", err);
        setResults([]);
      } finally {
        setLoading(false);
      }
    };

    runSearch();
  }, [search, role, currentUserId]);

  const handleSelectResult = (res: SearchResult) => {
    if (res.type === "task") navigate(`/tasks/edit/${res.id}`);
    if (res.type === "user") navigate(`/users/edit/${res.id}`);
    setResults([]);
    setSearch("");
  };

  const openMenu = (e: React.MouseEvent<HTMLElement>) =>
    setAnchorEl(e.currentTarget);
  const closeMenu = () => setAnchorEl(null);

  const handleProfile = () => {
    closeMenu();
    setOpenProfile(true);
  };

  const handleLogout = async () => {
    closeMenu();
    try {
      await storageLogout();
    } finally {
      clearCachedUser();
      removeToken();
      navigate("/login");
    }
  };

  return (
    <>
      <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between p-6">
        {/* 🔍 Search Bar */}
        <div
          className="flex items-center gap-2 w-1/2 px-4 py-2 mx-5 my-3 rounded-md border border-gray-200 bg-gray-50"
          ref={setPopperAnchor}
        >
          <Search size={20} className="text-gray-500" />
          <input
            placeholder={
              role === "admin"
                ? "Search tasks or users..."
                : "Search your tasks or users..."
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent outline-none w-full text-sm"
          />

          {loading && <CircularProgress size={18} />}

          <Popper open={results.length > 0} anchorEl={popperAnchor}>
            <ClickAwayListener onClickAway={() => setResults([])}>
              <Paper
                elevation={3}
                sx={{
                  width: popperAnchor?.clientWidth || 300,
                  mt: 1,
                  maxHeight: 300,
                  overflowY: "auto",
                  borderRadius: 2,
                }}
              >
                <List>
                  {results.map((res) => (
                    <ListItemButton
                      key={`${res.type}-${String(res.id)}`}
                      onClick={() => handleSelectResult(res)}
                    >
                      <ListItemText primary={res.label} />
                    </ListItemButton>
                  ))}
                </List>
              </Paper>
            </ClickAwayListener>
          </Popper>
        </div>

        {/* 🔔 Profile Section */}
        <div className="flex items-center gap-5">
          <Bell className="text-gray-500 cursor-pointer" size={24} />

          <Tooltip title="View Profile" arrow>
            <Box
              onClick={openMenu}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                cursor: "pointer",
              }}
            >
              <IconButton size="small">
                <Avatar src={avatarUrl || undefined}>
                  {!avatarUrl && userName
                    ? userName[0]?.toUpperCase()
                    : "U"}
                </Avatar>
              </IconButton>

              <span className="text-md font-medium text-gray-700">
                {userName}
              </span>
            </Box>
          </Tooltip>

          <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={closeMenu}>
            <MenuItem onClick={handleProfile}>My Profile</MenuItem>
            <MenuItem onClick={handleLogout}>Logout</MenuItem>
          </Menu>
        </div>
      </header>

      <ProfileDialog
        open={openProfile}
        onClose={() => {
          setOpenProfile(false);
          refreshUserInfo();
        }}
      />
    </>
  );
};

export default Header;
