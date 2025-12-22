// src/pages/tasks/TaskListPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import TaskFilters from "../../components/tasks/TaskFilters";
import TaskFiltersCard from "../../components/tasks/TaskFiltersCard";
import TaskTable from "../../components/tasks/TaskTable";
import TaskCard from "../../components/tasks/TaskCard";

import { getTasks, deleteTask, updateTask, Task } from "../../services/taskService";

import { getAllUsers, getAllUsersIncludingDeleted } from "../../services/userService";

import { getCurrentUser } from "../../utils/storage"; // <-- centralized helper (tries many endpoints)
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import ConfirmDeleteDialog from "../../components/common/ConfirmDeleteDialog";

import { Pagination, FormControl, MenuItem, Select, Typography } from "@mui/material";

const rowsPerPageOptions = [5, 10, 20];

// normalized user shape expected by TaskFilters / TaskFiltersCard
type MinimalUser = { id: number | string; name: string; isDeleted?: boolean };

const TaskListPage: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [viewMode, setViewMode] = useState<"list" | "card">("list");

  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  // <-- allow string (Mongo id) or number or empty string
  const [assignedTo, setAssignedTo] = useState<number | string | "">("");

  const [fromDate, setFromDate] = useState<string | "">("");
  const [toDate, setToDate] = useState<string | "">("");

  const [users, setUsers] = useState<MinimalUser[]>([]);
  const [allUsers, setAllUsers] = useState<MinimalUser[]>([]);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);


  const navigate = useNavigate();

  /* -----------------------------------------------------
       LOAD TASKS + USERS — WITH ADMIN SUPPORT & graceful fallback
  ----------------------------------------------------- */
  const load = async () => {
    try {
      // 1) current user (centralized helper)
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        toast.error("Unable to determine current user (authenticate or check backend).");
        setTasks([]);
        setUsers([]);
        setAllUsers([]);
        return;
      }

      const currentUserId = String(currentUser.id);
      const currentUserRole = (currentUser.role ?? "user").toString().toLowerCase();

      // 2) fetch tasks
      let allTasksRaw: any = [];
      try {
        allTasksRaw = await getTasks();
      } catch (err: any) {
        console.error("getTasks failed:", err);
        toast.error("Failed to load tasks");
        setTasks([]);
        // continue to try loading users (but tasks are empty)
        allTasksRaw = [];
      }

      const allTasksArr: Task[] = Array.isArray(allTasksRaw)
        ? allTasksRaw
        : (allTasksRaw && Array.isArray((allTasksRaw as any).items) ? (allTasksRaw as any).items : []);

      let visibleTasks: Task[] = [];

      if (currentUserRole === "admin") {
        visibleTasks = allTasksArr;
      } else {
        visibleTasks = allTasksArr.filter((task: Task) => String(task.createdById ?? "") === currentUserId);
      }

      const sorted = visibleTasks.sort(
        (a, b) =>
          (Number(a.priority) || 0) - (Number(b.priority) || 0) ||
          (a.createdAt > b.createdAt ? -1 : 1)
      );

      setTasks(sorted);

      // 3) load users for dropdowns — handle 403/401 gracefully (treat as non-admin)
      let activeUsers: any[] = [];
      let allUsersFull: any[] = [];

      // helper to attempt fetching and treat 403 as "not allowed"
      const tryGetUsers = async (fn: () => Promise<any[]>) => {
        try {
          const r = await fn();
          return Array.isArray(r) ? r : (r && Array.isArray((r as any).items) ? (r as any).items : []);
        } catch (err: any) {
          // If backend returns 403 Forbidden (e.g. "role not found"), treat as not admin.
          if (err?.status === 403) {
            console.warn("User fetch forbidden (403) — treating as non-admin for frontend display");
            return null; // signal forbidden
          }
          // other errors -> log and return empty
          console.error("User fetch error:", err);
          return [];
        }
      };

      const activeRes = await tryGetUsers(() => getAllUsers());
      const allRes = await tryGetUsers(() => getAllUsersIncludingDeleted());

      // If activeRes === null, it means backend forbade access (403) -> treat user as non-admin
      const isForbidden = activeRes === null || allRes === null;
      if (isForbidden && currentUserRole === "admin") {
        // role indicated admin on client but server forbids — warn, and fallback to current user only
        console.warn("Server denies users list despite client saying admin. Falling back to current user only.");
      }

      activeUsers = activeRes === null ? [] : activeRes;
      allUsersFull = allRes === null ? [] : allRes;

      // For non-admins: only include current user in dropdown
      let uiUsers = Array.isArray(activeUsers) ? activeUsers : [];
      if (currentUserRole !== "admin" || isForbidden) {
        uiUsers = uiUsers.filter((u) => {
          const rawId = u.id ?? u.userID ?? u.UserID ?? u._id ?? "";
          return String(rawId) === currentUserId || String(u.emailID ?? u.email ?? "") === String(currentUser.email);
        });

        // If nothing matched (maybe different field names), ensure we include at least current user model
        if (uiUsers.length === 0) {
          uiUsers = [
            {
              id: currentUserId,
              name: `${currentUser.firstName ?? ""} ${currentUser.lastName ?? ""}`.trim() || String(currentUserId),
            },
          ];
        }
      }

      // Normalize helper
      const normalizeUser = (u: any): MinimalUser => {
        const rawId = u.id ?? u.userID ?? u.UserID ?? u._id ?? u.ID ?? "";
        const parsed = Number(rawId);
        const id = Number.isFinite(parsed) ? parsed : String(rawId ?? "");
        const name =
          (u.firstName ?? u.first ?? u.UserName ?? u.userName ?? u.name ?? u.userName ?? "")
            .toString()
            .trim() || String(id);
        return { id, name, isDeleted: !!(u.isDeleted ?? u.IsDeleted) };
      };

      setUsers(uiUsers.map((u) => normalizeUser(u)));
      setAllUsers((Array.isArray(allUsersFull) ? allUsersFull : []).map((u) => normalizeUser(u)));
    } catch (err) {
      console.error("Error loading data:", err);
      toast.error("Failed to load data");
      setTasks([]);
      setUsers([]);
      setAllUsers([]);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* -----------------------------------------------------
       MAP USERS FOR TABLE DISPLAY (deleted tag)
  ----------------------------------------------------- */
  const usersMap = useMemo(() => {
    const map: Record<string | number, string> = {};
    allUsers.forEach((u) => {
      const key = u.id;
      const name = u.name || String(u.id);
      map[key] = u.isDeleted ? `${name} (deleted)` : name;
    });
    return map;
  }, [allUsers]);

  /* -----------------------------------------------------
       FILTER LOGIC
       NOTE: make comparisons tolerant of numeric/string ids
  ----------------------------------------------------- */
  const filtered = tasks.filter((t) => {
    if (
      search &&
      !String(t.name ?? "").toLowerCase().includes(search.toLowerCase()) &&
      !String(t.descriptionPlain ?? "").toLowerCase().includes(search.toLowerCase())
    )
      return false;

    if (status === "complete" && !t.completed) return false;
    if (status === "incomplete" && t.completed) return false;

    if (priority !== "" && Number(priority) !== t.priority) return false;

    if (assignedTo !== "") {
      const assignedStrings = (t.assignedToIds || []).map((x: any) => String(x));
      if (!assignedStrings.includes(String(assignedTo))) return false;
    }

    if (fromDate) {
      const fd = new Date(fromDate);
      if (!t.dueDate || new Date(t.dueDate) < fd) return false;
    }

    if (toDate) {
      const td = new Date(toDate);
      if (!t.dueDate || new Date(t.dueDate) > td) return false;
    }

    return true;
  });

  /* -----------------------------------------------------
       PAGINATION
  ----------------------------------------------------- */
 
  const pageItems = filtered

  /* -----------------------------------------------------
       CRUD
       Prevent delete unless task.completed === true
  ----------------------------------------------------- */
  const handleDeleteClick = (id: string | number) => {
    const idStr = String(id);
    const found = tasks.find((t) => String((t as any).id ?? (t as any)._id ?? "") === idStr);
    if (!found) {
      toast.error("Task not found in current list; cannot delete.");
      return;
    }

    if (!found.completed) {
      toast.info("This task is not complete — can't delete it");
      return;
    }

    setDeleteId(String(id));
    setConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (deleteId == null) return;
    try {
      setDeleting(true);
      await deleteTask(String(deleteId));
      toast.success("Task deleted successfully");
      setConfirmOpen(false);
      setDeleteId(null);
      await load();
    } catch (err) {
      console.error("Delete failed:", err);
      toast.error("Failed to delete task");
    } finally {
      setDeleting(false);
    }
  };

  const handleEdit = (id: string | number) => navigate(`/tasks/edit/${id}`);

  const handleToggleComplete = async (task: Task) => {
    const updated = { ...task, completed: !task.completed };
    try {
      await updateTask(updated);
      toast.success(updated.completed ? "Marked complete" : "Marked incomplete");
      await load();
    } catch (err) {
      console.error("Toggle complete failed:", err);
      toast.error("Failed to update task");
    }
  };

  const handleExport = () => {
    if (filtered.length === 0) return toast.info("No tasks to export");

    const csv = [
      ["Task Name", "Description", "Priority", "Due Date", "Completed"],
      ...filtered.map((t) => [
        t.name,
        (t.descriptionPlain || "").replace(/,/g, " "),
        ["Low", "Medium", "High"][t.priority],
        t.dueDate ? new Date(t.dueDate).toLocaleDateString() : "",
        t.completed ? "Yes" : "No",
      ]),
    ]
      .map((r) => r.join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "tasks.csv";
    a.click();
  };

  const handleRefresh = () => load();

  const toggleViewMode = () => {
    setViewMode((prev) => (prev === "list" ? "card" : "list"));
  };

  /* -----------------------------------------------------
       UI — NO CHANGES
  ----------------------------------------------------- */
  return (
    <div className="p-4 overflow-hidden">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-3xl font-semibold">Tasks</h2>
          <p className="text-md text-gray-500">Manage and track your tasks efficiently</p>
        </div>
      </div>

      <div className="rounded shadow p-4 bg-white">
        {viewMode === "card" ? (
          <TaskFiltersCard
            search={search}
            setSearch={setSearch}
            status={status}
            setStatus={setStatus}
            priority={priority}
            setPriority={setPriority}
            assignedTo={assignedTo}
            setAssignedTo={(v) => {
              if (v === "") return setAssignedTo("");
              if (typeof v === "number") return setAssignedTo(v);
              const n = Number(v);
              return Number.isFinite(n) ? setAssignedTo(n) : setAssignedTo(String(v));
            }}
            users={allUsers.filter((u) => typeof u.id === "number") as Array<{ id: number; name: string; isDeleted?: boolean }>}
            onAdd={() => navigate("/tasks/create")}
            onExport={handleExport}
            onRefresh={handleRefresh}
            onToggleView={toggleViewMode}
            viewMode={viewMode}
            setViewMode={setViewMode}
          />
        ) : (
          <TaskFilters
            search={search}
            setSearch={setSearch}
            status={status}
            setStatus={setStatus}
            priority={priority}
            setPriority={setPriority}
            assignedTo={assignedTo}
            setAssignedTo={(v) => {
              if (v === "") return setAssignedTo("");
              if (typeof v === "number") return setAssignedTo(v);
              const n = Number(v);
              return Number.isFinite(n) ? setAssignedTo(n) : setAssignedTo(String(v));
            }}
            users={allUsers.filter((u) => typeof u.id === "number") as Array<{ id: number; name: string; isDeleted?: boolean }>}
            fromDate={fromDate}
            toDate={toDate}
            setFromDate={setFromDate}
            setToDate={setToDate}
            onAdd={() => navigate("/tasks/create")}
            onExport={handleExport}
            onRefresh={handleRefresh}
            onToggleView={toggleViewMode}
            viewMode={viewMode}
          />
        )}
      </div>

      <div className="mt-4 bg-white rounded-lg shadow overflow-hidden">
        {viewMode === "list" ? (
          <TaskTable
            tasks={pageItems}
            usersMap={usersMap}
            onEdit={handleEdit}
            onDelete={handleDeleteClick}
            onToggleComplete={handleToggleComplete}
          />
        ) : (
          <div className="grid gap-3 p-4">
            {pageItems.map((t) => (
              <TaskCard
                key={(t as any).id ?? (t as any)._id}
                task={t}
                usersMap={usersMap}
                onEdit={(id) => navigate(`/tasks/edit/${id}`)}
                onDelete={handleDeleteClick}
                onToggleComplete={handleToggleComplete}
              />
            ))}
          </div>
        )}
      </div>
      <ConfirmDeleteDialog
        open={confirmOpen}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Task?"
        message="Are you sure you want to delete this task?"
        loading={deleting}
      />
    </div>
  );
};

export default TaskListPage;
