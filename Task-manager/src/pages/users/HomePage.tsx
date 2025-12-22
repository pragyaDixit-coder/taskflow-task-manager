// src/pages/home/HomePage.tsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import StatCard from "../../components/common/StatCard";
import {
  Clock,
  CheckCircle,
  AlertTriangle,
  Users as UsersIcon,
  PlusCircle,
  UserPlus,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import { Button, Tooltip, IconButton, TextField, InputAdornment } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { getTasks, Task } from "../../services/taskService";
import { getAllUsers } from "../../services/userService";
import { getCurrentUser,fetchCurrentUserFromServer } from "../../utils/storage"; // keep same helper
import UserDialog from "../../pages/users/UserDialog";

/**
 * HomePage — added search bar for Recent Tasks table (search by task name or user)
 */

const HomePage: React.FC = () => {
  const navigate = useNavigate();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [usersMap, setUsersMap] = useState<Record<string, string>>({});
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [openUserDialog, setOpenUserDialog] = useState(false);

  const [activeUsersCount, setActiveUsersCount] = useState<number>(0);
  const [currentUser, setCurrentUser] = useState<any>(null);

  const [startIndex, setStartIndex] = useState(0);
  const tasksPerPage = 3;

  // SEARCH state
  const [searchQuery, setSearchQuery] = useState<string>("");

  const handleNext = () => {
    if (startIndex + tasksPerPage < filteredTasks.length) setStartIndex((s) => s + tasksPerPage);
  };
  const handlePrev = () => {
    if (startIndex > 0) setStartIndex((s) => s - tasksPerPage);
  };

  // small helper to interpret common truthy/falsey fields
  const boolFrom = (v: any): boolean | undefined => {
    if (v === undefined || v === null) return undefined;
    if (typeof v === "boolean") return v;
    if (typeof v === "number") return v !== 0;
    if (typeof v === "string") {
      const s = v.trim().toLowerCase();
      if (s === "") return undefined;
      if (["true", "1", "yes", "y", "active", "enabled"].includes(s)) return true;
      if (["false", "0", "no", "n", "inactive", "disabled", "deleted"].includes(s)) return false;
      return undefined;
    }
    return undefined;
  };

  // normalize a backend user into a minimal structure with a reliable id, name and isDeleted hint
  const normalizeBackendUser = (u: any) => {
    const id = u?.id ?? u?._id ?? u?.userID ?? u?.UserID ?? u?.ID ?? "";
    const name =
      (u?.firstName ?? u?.first ?? u?.name ?? u?.userName ?? u?.lastName ?? "")
        .toString()
        .trim() || String(id);

    // candidate fields that may indicate deletion or active state
    const candidates = {
      isDeleted: u?.isDeleted ?? u?.IsDeleted ?? u?.deleted ?? u?.Deleted ?? undefined,
      active: u?.isActive ?? u?.active ?? u?.isEnabled ?? u?.enabled ?? undefined,
      status: typeof u?.status === "string" ? u.status : undefined,
      disabled: u?.disabled ?? u?.isDisabled ?? undefined,
    };

    const candIsDeleted = boolFrom(candidates.isDeleted);
    const candActive = boolFrom(candidates.active);
    const candDisabled = boolFrom(candidates.disabled);
    const candStatus = typeof candidates.status === "string" ? candidates.status.trim().toLowerCase() : undefined;

    let isDeleted: boolean | undefined = undefined;
    if (candIsDeleted !== undefined) isDeleted = candIsDeleted;
    else if (candActive !== undefined) isDeleted = !candActive;
    else if (candDisabled !== undefined) isDeleted = Boolean(candDisabled);
    else if (candStatus !== undefined) {
      if (["deleted", "inactive", "disabled"].includes(candStatus)) isDeleted = true;
      else if (["active", "enabled"].includes(candStatus)) isDeleted = false;
    }

    const createdById = u?.createdById ?? u?.CreatedBy ?? u?.createdBy ?? u?.creator ?? null;

    return {
      id: String(id),
      name,
      raw: u,
      isDeleted,
      createdById: createdById == null ? null : String(createdById),
      candidateFields: { candidates, candIsDeleted, candActive, candDisabled, candStatus },
    };
  };

  // robust role detection: tries many common patterns so 'admin' is not missed
  const detectRole = (cu: any): "admin" | "user" => {
    if (!cu) return "user";
    const roleField = (cu.role ?? cu.userType ?? cu.roleName ?? cu.roles ?? cu.type ?? "").toString?.() ?? "";
    // direct match
    if (typeof roleField === "string" && roleField.toLowerCase().includes("admin")) return "admin";
    // array of roles
    if (Array.isArray(cu.roles) && cu.roles.some((r: any) => String(r).toLowerCase().includes("admin"))) return "admin";
    // explicit flags
    if (cu.isAdmin === true || cu.is_superuser === true || cu.is_superuser === "true" || cu.is_superuser === 1) return "admin";
    if (cu.is_admin === true || cu.is_admin === "true") return "admin";
    if (cu.permissions && Array.isArray(cu.permissions) && cu.permissions.some((p: any) => String(p).toLowerCase().includes("admin"))) return "admin";
    // email heuristic (useful for dev / seeded admin like admin@tm.com)
    if (typeof cu.email === "string" && cu.email.toLowerCase().includes("admin")) return "admin";
    // fallback
    return "user";
  };

  const loadData = async () => {
    console.log("🟦 DEBUG: loadData() triggered");
    try {
      // current user
      let cu: any = null;
      try {
        cu = await getCurrentUser();
        console.log("🟩 DEBUG getCurrentUser() returned:", cu);
      } catch (err) {
        console.warn("🟥 getCurrentUser() threw:", err);
      }

      // fallback to local storage (non-ideal but safe fallback)
      if (!cu) {
        try {
          const raw = localStorage.getItem("currentUser");
          console.log("🟨 DEBUG localStorage currentUser raw:", raw);
          if (raw) cu = JSON.parse(raw);
        } catch (err) {
          console.warn("🟥 parsing localStorage currentUser failed:", err);
        }
      }

      setCurrentUser(cu ?? null);

      // tasks — normalize whether API returned array or wrapper { items, total, ... }
      let allTasks: Task[] = [];
      try {
        const fetched = await getTasks();
        console.log("🟦 DEBUG getTasks() raw:", fetched);
        if (Array.isArray(fetched)) allTasks = fetched;
        else if (Array.isArray((fetched as any).items)) allTasks = (fetched as any).items;
        else if (Array.isArray((fetched as any).data)) allTasks = (fetched as any).data;
        else allTasks = [];
      } catch (err) {
        console.error("🟥 Failed to fetch tasks:", err);
        allTasks = [];
      }

      // determine role and current user id string
      const role = detectRole(cu);
      const currentUserIdStr = cu ? String(cu.id ?? cu._id ?? cu.userID ?? cu.UserID ?? "") : "";
      console.log("🟦 DEBUG currentUser role/id:", { role, currentUserIdStr });

      // show tasks depending on role
      const visibleTasks =
        role === "admin"
          ? allTasks
          : allTasks.filter((t) => String((t as any).createdById ?? (t as any).CreatedBy ?? (t as any).createdBy ?? "") === currentUserIdStr);
      console.log("🟦 DEBUG visibleTasks count:", visibleTasks.length);
      setTasks(visibleTasks);

      // users
      let allUsers: any[] = [];
      try {
        const fetchedUsers = await getAllUsers();
        console.log("🟦 DEBUG getAllUsers() raw:", fetchedUsers);
        if (Array.isArray(fetchedUsers)) allUsers = fetchedUsers;
        else if (Array.isArray((fetchedUsers as any).items)) allUsers = (fetchedUsers as any).items;
        else if (Array.isArray((fetchedUsers as any).data)) allUsers = (fetchedUsers as any).data;
        else allUsers = [];
      } catch (err) {
        console.error("🟥 Failed to fetch users:", err);
        allUsers = [];
      }

      console.log("🟦 DEBUG first 6 raw users:", allUsers.slice(0, 6));

      const normalized = allUsers.map(normalizeBackendUser);
      console.log("🟦 DEBUG normalized users sample (first 10):", normalized.slice(0, 10));

      // build usersMap used by calendar -> map id -> name
      const map: Record<string, string> = {};
      normalized.forEach((u) => {
        map[u.id] = u.name;
      });
      setUsersMap(map);

      // detect whether backend provided any explicit isDeleted/active info
      const anyExplicit = normalized.some((u) => typeof u.isDeleted !== "undefined");
      console.log("🟦 DEBUG anyExplicitDeletedFlagPresent:", anyExplicit);

      // compute count:
      // - if backend gives explicit isDeleted -> count only where isDeleted !== true
      // - otherwise assume users are active (for admin count all; for non-admin count those created by current user)
      let count = 0;
      if (!anyExplicit) {
        console.log("🟦 DEBUG: No explicit deleted/active info from backend — assuming all users active (unless filtered by creator).");
        if (role === "admin") {
          count = normalized.length;
        } else if (currentUserIdStr) {
          count = normalized.filter((u) => String(u.createdById ?? "") === currentUserIdStr).length;
        } else {
          count = normalized.length;
        }
      } else {
        if (role === "admin") {
          count = normalized.filter((u) => u.isDeleted !== true).length;
        } else if (currentUserIdStr) {
          count = normalized.filter((u) => u.isDeleted !== true && String(u.createdById ?? "") === currentUserIdStr).length;
        } else {
          count = normalized.filter((u) => u.isDeleted !== true).length;
        }
      }

      console.log("🟦 DEBUG computed activeUsersCount:", count, "totalUsers:", normalized.length);
      setActiveUsersCount(count);
    } catch (err) {
      console.error("🟥 Unexpected error in loadData:", err);
    }
  };

  useEffect(() => {
  loadData();

  // 🔥 listen for profile updates (from ProfileDialog)
  const onUserUpdate = async () => {
    console.log("🟦 DEBUG: user:update event received in HomePage");

    try {
      const freshUser = await fetchCurrentUserFromServer();
      setCurrentUser(freshUser ?? null);
    } catch (err) {
      console.error("🟥 Failed to refresh current user on HomePage", err);
    }
  };

  window.addEventListener("user:update", onUserUpdate);

  return () => {
    window.removeEventListener("user:update", onUserUpdate);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);


  const pendingCount = tasks.filter((t) => !t.completed).length;
  const completedCount = tasks.filter((t) => t.completed).length;
  const overdueCount = tasks.filter((t) => t.dueDate && new Date(t.dueDate) < new Date() && !t.completed).length;

  // Build filtered tasks using searchQuery (search by task name or assigned user names)
  const normalizedQuery = (searchQuery || "").trim().toLowerCase();
  const filteredTasks = (normalizedQuery
    ? tasks.filter((t) => {
        const taskName = String((t as any).name ?? (t as any).taskName ?? "").toLowerCase();
        if (taskName.includes(normalizedQuery)) return true;

        // assigned user ids / names: try several common field names
        const assignedIds =
          (t as any).assignedToIds ??
          (t as any).AssignedToIds ??
          (t as any).assignedTo ??
          (t as any).AssignedTo ??
          (t as any).assignedUsers ??
          (t as any).TaskAssignedUsers ??
          [];

        // assigned could be array of ids or objects
        const assignedNames: string[] = [];

        if (Array.isArray(assignedIds)) {
          for (const a of assignedIds) {
            if (!a) continue;
            // if it's object with id/_id
            if (typeof a === "object") {
              const id = String(a._id ?? a.id ?? a.userID ?? a.UserID ?? "").trim();
              const nm = id && usersMap[id] ? usersMap[id] : (a.name ?? a.firstName ?? a.userName ?? "");
              if (nm) assignedNames.push(String(nm).toLowerCase());
            } else {
              const id = String(a).trim();
              if (id && usersMap[id]) assignedNames.push(String(usersMap[id]).toLowerCase());
            }
          }
        } else if (typeof assignedIds === "string") {
          // maybe comma separated ids
          const parts = assignedIds.split?.(",")?.map((p: string) => p.trim()) ?? [];
          for (const p of parts) {
            if (p && usersMap[p]) assignedNames.push(String(usersMap[p]).toLowerCase());
          }
        }

        if (assignedNames.some((n) => n.includes(normalizedQuery))) return true;

        // also test createdBy name if available
        const createdById = String((t as any).createdById ?? (t as any).CreatedBy ?? (t as any).createdBy ?? "");
        if (createdById && usersMap[createdById] && String(usersMap[createdById]).toLowerCase().includes(normalizedQuery)) return true;

        // fallback: search some other textual fields (description)
        const desc = String((t as any).description ?? (t as any).notes ?? "").toLowerCase();
        if (desc.includes(normalizedQuery)) return true;

        return false;
      })
    : tasks
  ) as Task[];

  const visibleTasks = filteredTasks.slice(startIndex, startIndex + tasksPerPage);

  return (
    <div className="flex flex-col p-4 gap-6 bg-gray-50 min-h-0">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-800">Welcome back, {currentUser?.firstName || currentUser?.name || "User"}!</h2>
          <p className="text-gray-500 text-md">Here's what’s happening today in your workspace.</p>
        </div>

        <div className="flex gap-3">
          <Button
            variant="contained"
            startIcon={<Tooltip title="Create a new task" arrow><PlusCircle size={20} /></Tooltip>}
            onClick={() => navigate("/tasks/create")}
            sx={{ background: "linear-gradient(90deg, #007bff 0%, #0a54c3 100%)", "&:hover": { background: "linear-gradient(90deg, #007bff 0%, #0849ab 100%)" }, textTransform: "none", borderRadius: "8px", fontSize: "0.875rem" }}
          >
            New Task
          </Button>

          <Button
            variant="contained"
            startIcon={<Tooltip title="Add a new user to the system" arrow><UserPlus size={20} /></Tooltip>}
            onClick={() => setOpenUserDialog(true)}
            sx={{ background: "linear-gradient(90deg, #007bff 0%, #0a54c3 100%)", "&:hover": { background: "linear-gradient(90deg, #007bff 0%, #0849ab 100%)" }, textTransform: "none", borderRadius: "8px", fontSize: "0.875rem" }}
          >
            New User
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatCard title="Pending Tasks" value={pendingCount} icon={<Tooltip title="Total pending tasks" arrow><Clock size={20} className="text-amber-500" /></Tooltip>} color="bg-amber-100" />
        <StatCard title="Completed Tasks" value={completedCount} icon={<Tooltip title="Total completed tasks" arrow><CheckCircle size={20} className="text-green-500" /></Tooltip>} color="bg-green-100" />
        <StatCard title="Overdue Tasks" value={overdueCount} icon={<Tooltip title="Overdue tasks" arrow><AlertTriangle size={20} className="text-red-500" /></Tooltip>} color="bg-red-100" />
        <StatCard title="Active Users" value={activeUsersCount} icon={<Tooltip title="Users you have created" arrow><UsersIcon size={20} className="text-blue-500" /></Tooltip>} color="bg-blue-100" />
      </div>

      <div className="flex gap-6">
        <div className="bg-white px-6 py-3 rounded-xl shadow-lg flex-1">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-semibold text-gray-800 text-2xl">Recent Tasks</h4>

            

              <div className="flex gap-2">
                <IconButton onClick={handlePrev} disabled={startIndex === 0} size="small"><ChevronLeft /></IconButton>
                <IconButton onClick={handleNext} disabled={startIndex + tasksPerPage >= filteredTasks.length} size="small"><ChevronRight /></IconButton>
              </div>
            
          </div>
          {/* SEARCH BAR + PAGINATION CONTROLS */}
            <div className="flex items-center gap-3">
              <TextField
                size="small"
                placeholder="Search tasks or users..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setStartIndex(0); // reset to first page when searching
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                }}
                sx={{ minWidth: 350, height: 40, backgroundColor: "#f9f9f9" }}
              />
          </div>

          <table className="w-full text-lg mt-4">
            <thead>
              <tr className="text-gray-500 bg-gray-50 border-b border-gray-200">
                <th className="text-left py-4">Task Name</th>
                <th className="text-left py-4">Due Date</th>
                <th className="text-left py-4">Priority</th>
                <th className="text-left py-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {visibleTasks.length > 0 ? (
                visibleTasks.map((t) => (
                  <tr key={t.id} className="border-b border-gray-200">
                    <td className="py-4 font-medium text-md">{t.name}</td>
                    <td className="text-gray-500 text-sm">{t.dueDate ? new Date(t.dueDate).toDateString() : "—"}</td>
                    <td>
                      <span className={`px-5 py-1 rounded-full text-sm ${t.priority === 2 ? "bg-red-100 text-red-600" : t.priority === 1 ? "bg-yellow-100 text-yellow-600" : "bg-green-100 text-green-600"}`}>
                        {t.priority === 2 ? "High" : t.priority === 1 ? "Medium" : "Low"}
                      </span>
                    </td>
                    <td>
                      <span className={`px-5 py-1 rounded-full text-sm font-medium ${t.completed ? "bg-green-100 text-green-600" : "bg-blue-100 text-blue-600"}`}>{t.completed ? "Completed" : "Pending"}</span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="text-center text-gray-500 py-6">No tasks found</td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="text-center text-gray-500 mt-3 text-sm">Showing {filteredTasks.length === 0 ? 0 : startIndex + 1}–{Math.min(startIndex + tasksPerPage, filteredTasks.length)} of {filteredTasks.length}</div>
        </div>

        <div className="bg-white px-6 py-3 rounded-xl shadow-lg w-1/3">
          <h4 className="font-semibold text-2xl text-gray-800">Calendar</h4>

          <Calendar
            value={selectedDate}
            onChange={(value) => setSelectedDate(value as Date)}
            tileContent={({ date }) => {
              const tasksForDate = tasks.filter((t) => t.dueDate && new Date(t.dueDate).toDateString() === date.toDateString());
              if (tasksForDate.length > 0) {
                const tooltipText = tasksForDate.map((t) => `${t.name} (${(t.assignedToIds || []).map((id: any) => usersMap[String(id)]).filter(Boolean).join(", ")})`).join(", ");
                return (
                  <Tooltip title={tooltipText} arrow>
                    <div className="w-1.5 h-1.5 bg-[#0a54c3] rounded-full mx-auto mt-1"></div>
                  </Tooltip>
                );
              }
              return null;
            }}
            className="rounded-lg border border-gray-200 p-3 text-sm"
            prev2Label={null}
            next2Label={null}
          />
        </div>
      </div>

      <UserDialog 
      open={openUserDialog} 
      onClose={() => setOpenUserDialog(false)} 
      onSaved={async () => { setOpenUserDialog(false); await loadData(); navigate("/users"); }} 
      />
    </div>
  );
};

export default HomePage;
