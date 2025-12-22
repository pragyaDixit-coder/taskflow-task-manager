// src/services/taskService.ts
import { apiFetch } from "../utils/http";

/**
 * Frontend Task service — matches backend routes mounted at:
 *   app.use(`${API_PREFIX}/TaskManagement`, taskRoutes);
 * and taskRoutes uses '/tasks' prefix.
 *
 * Endpoints used:
 *  GET  /api/TaskManagement/tasks
 *  GET  /api/TaskManagement/tasks/:id
 *  POST /api/TaskManagement/tasks
 *  PUT  /api/TaskManagement/tasks/:id
 *  DELETE /api/TaskManagement/tasks/:id
 *  PATCH /api/TaskManagement/tasks/:id/complete
 */

/* ---------------- Types ---------------- */
export type Task = {
  id: string;
  name: string;
  descriptionHtml?: string;
  descriptionPlain?: string;
  assignedToIds: string[]; // user IDs (strings)
  assignedToUsers?: Array<{ id: string; firstName?: string; lastName?: string; email?: string }>;
  dueDate?: string | null;
  priority: 0 | 1 | 2;
  completed: boolean;
  createdAt: string;
  updatedAt?: string | null;
  completedByUserId?: string | null;
  completedOn?: string | null;
  createdById?: string | null;
};

/* ---------------- Helpers ---------------- */

const toStr = (v: any) => (v === null || v === undefined ? "" : String(v));

/**
 * mapBackendTask
 * Convert backend Mongoose document (possibly populated) to Task
 */
const mapBackendTask = (t: any): Task => {
  if (!t) {
    return {
      id: "",
      name: "",
      descriptionHtml: "",
      descriptionPlain: "",
      assignedToIds: [],
      assignedToUsers: [],
      dueDate: null,
      priority: 0,
      completed: false,
      createdAt: new Date().toISOString(),
    };
  }

  // assignedTo may be:
  // - array of ObjectId strings
  // - array of populated user objects { _id, firstName, lastName, email }
  // - array of mixed
  const assignedRaw = t.assignedTo ?? t.AssignedTo ?? t.TaskAssignedUser ?? t.assignedUsers ?? t.assignedToIds ?? [];
  let assignedToIds: string[] = [];
  let assignedToUsers: Array<{ id: string; firstName?: string; lastName?: string; email?: string }> = [];

  if (Array.isArray(assignedRaw)) {
    assignedRaw.forEach((a: any) => {
      // populated object
      if (a && typeof a === "object" && (a._id || a.id || a.firstName || a.lastName)) {
        const id = toStr(a._id ?? a.id ?? a.userId ?? a._id);
        assignedToIds.push(id);
        assignedToUsers.push({
          id,
          firstName: a.firstName,
          lastName: a.lastName,
          email: a.email,
        });
      } else {
        // primitive id (string/number)
        const id = toStr(a);
        if (id) assignedToIds.push(id);
      }
    });
  } else if (typeof assignedRaw === "string") {
    assignedToIds = assignedRaw.split(",").map((s: string) => s.trim()).filter(Boolean);
  }

  // name/title
  const name = t.taskName ?? t.TaskName ?? t.name ?? t.title ?? "";

  // description
  const descriptionPlain = t.descrPlainText ?? t.descriptionPlain ?? t.description ?? "";
  const descriptionHtml = t.descrFormattedText ?? t.descriptionHtml ?? t.descriptionFormatted ?? "";

  // priority
  const priorityRaw = t.priority ?? t.Priority ?? 0;
  const priority = typeof priorityRaw === "number" ? priorityRaw : Number(priorityRaw || 0) as 0 | 1 | 2;

  // createdAt/updatedAt
  const createdAt = toStr(t.createdAt ?? t.createdOn ?? t.CreatedOn ?? t.createdAt ?? t.createdAt) || new Date().toISOString();
  const updatedAt = t.updatedAt ?? t.updatedOn ?? t.UpdatedOn ?? null;

  return {
    id: toStr(t._id ?? t.id ?? t.TaskID ?? t.taskID ?? ""),
    name: String(name),
    descriptionHtml: descriptionHtml || undefined,
    descriptionPlain: descriptionPlain || undefined,
    assignedToIds,
    assignedToUsers: assignedToUsers.length ? assignedToUsers : undefined,
    dueDate: t.dueDate ?? t.DueDate ?? null,
    priority: (priority as 0 | 1 | 2),
    completed: !!(t.completed ?? t.Completed),
    createdAt,
    updatedAt: updatedAt ?? null,
    completedByUserId: toStr(t.completedByUserId ?? t.CompletedByUserID ?? t.completedBy ?? null) || null,
    completedOn: t.completedOn ?? t.CompletedOn ?? null,
    createdById: toStr(t.createdBy ?? t.CreatedBy ?? t.createdById ?? null) || null,
  };
};

/* ---------------- API calls ---------------- */

/**
 * getTasks
 * GET /api/TaskManagement/tasks
 * accepts optional paging & filters via query params object
 */
export const getTasks = async (opts?: {
  page?: number;
  limit?: number;
  filters?: {
    priority?: number;
    completed?: boolean;
    assignedTo?: string;
    dueDateFrom?: string;
    dueDateTo?: string;
    search?: string;
  };
}): Promise<{ items: Task[]; total?: number; page?: number; pages?: number }> => {
  try {
    const page = opts?.page ?? 1;
    const limit = opts?.limit ?? 1000; // keep large default to match earlier behaviour of fetching all
    const filters = opts?.filters ?? {};

    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(limit));

    if (typeof filters.priority !== "undefined") params.set("priority", String(filters.priority));
    if (typeof filters.completed !== "undefined") params.set("completed", String(filters.completed));
    if (filters.assignedTo) params.set("assignedTo", String(filters.assignedTo));
    if (filters.dueDateFrom) params.set("dueDateFrom", filters.dueDateFrom);
    if (filters.dueDateTo) params.set("dueDateTo", filters.dueDateTo);
    if (filters.search) params.set("search", filters.search);

    const raw = await apiFetch(`/api/TaskManagement/tasks?${params.toString()}`, {
      method: "GET",
    });

    // normalize response: backend listTasks returns { items, total, page, pages }
    let itemsAny: any[] = [];
    let total: number | undefined;
    let pageResp: number | undefined;
    let pages: number | undefined;

    if (!raw) {
      itemsAny = [];
    } else if (Array.isArray(raw)) {
      itemsAny = raw;
    } else if (Array.isArray(raw.items)) {
      itemsAny = raw.items;
      total = raw.total;
      pageResp = raw.page;
      pages = raw.pages;
    } else if (Array.isArray(raw.data)) {
      itemsAny = raw.data;
    } else if (Array.isArray(raw.Result)) {
      itemsAny = raw.Result;
    } else if (raw.items && Array.isArray(raw.items)) {
      itemsAny = raw.items;
    } else if (raw.items === undefined && raw.item && Array.isArray(raw.item)) {
      itemsAny = raw.item;
    } else {
      // maybe wrapper { items: [...] } or single object
      // try to detect object with items or return raw as single item array
      if (raw.items && Array.isArray(raw.items)) itemsAny = raw.items;
      else if (raw.data && Array.isArray(raw.data)) itemsAny = raw.data;
      else if (typeof raw === "object" && (raw._id || raw.id || raw.TaskID)) itemsAny = [raw];
      else itemsAny = [];
    }

    const items = itemsAny.map(mapBackendTask);
    return { items, total, page: pageResp, pages };
  } catch (err: any) {
    throw Object.assign(new Error(err?.message ?? "Failed to fetch tasks"), {
      status: err?.status,
      body: err?.body,
    });
  }
};

/**
 * getTaskById
 * GET /api/TaskManagement/tasks/:id
 */
export const getTaskById = async (id: string): Promise<Task | null> => {
  if (!id) return null;
  try {
    const raw = await apiFetch(`/api/TaskManagement/tasks/${encodeURIComponent(String(id))}`, {
      method: "GET",
    });
    if (!raw) return null;
    // backend returns item object directly
    const model = raw.task ?? raw.data ?? raw.item ?? raw;
    return mapBackendTask(model);
  } catch (err: any) {
    if (err?.status === 404) return null;
    throw Object.assign(new Error(err?.message ?? "Failed to fetch task"), {
      status: err?.status,
      body: err?.body,
    });
  }
};

/**
 * createTask
 * POST /api/TaskManagement/tasks
 *
 * NOTE: your backend service.createTask uses (payload, userId) on server side and sets createdBy
 * from session. So frontend can omit createdBy; but if you want to send createdById, you may.
 */
export const createTask = async (payload: {
  name: string;
  descriptionPlain?: string;
  descriptionHtml?: string;
  assignedToIds?: Array<string | number>;
  dueDate?: string | null;
  priority?: 0 | 1 | 2;
  completed?: boolean;
  createdById?: string | number | null; // optional
}): Promise<Task> => {
  try {
    // send shape expected by backend (taskName, assignedTo array of ids)
    const body: any = {
      taskName: String(payload.name ?? ""),
      taskNameCamel: String(payload.name ?? ""), // harmless extra field
      TaskName: String(payload.name ?? ""),
      descrPlainText: payload.descriptionPlain ?? "",
      descrFormattedText: payload.descriptionHtml ?? "",
      descriptionPlain: payload.descriptionPlain ?? "",
      descriptionHtml: payload.descriptionHtml ?? "",
      assignedTo: Array.isArray(payload.assignedToIds) ? (payload.assignedToIds as any[]).map(String) : [],
      dueDate: payload.dueDate ?? null,
      priority: payload.priority ?? 0,
      completed: !!payload.completed,
    };

    if (payload.createdById !== undefined && payload.createdById !== null) {
      body.createdBy = String(payload.createdById);
      body.createdById = String(payload.createdById);
    }

    const resp = await apiFetch("/api/TaskManagement/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    // backend returns created doc (item) or wrapper with items/inserted id
    const createdObj = resp.task ?? resp.data ?? resp.item ?? resp ?? null;
    // if resp contains inserted id, try fetching
    const insertedId = resp?.insertedId ?? resp?.id ?? resp?._id ?? resp?.createdId ?? null;

    if (createdObj && (createdObj._id || createdObj.id)) {
      return mapBackendTask(createdObj);
    }

    if (insertedId) {
      const fetched = await getTaskById(String(insertedId));
      if (fetched) return fetched;
    }

    // fallback: attempt to map resp
    if (createdObj) return mapBackendTask(createdObj);

    throw new Error("Failed to create task: invalid server response");
  } catch (err: any) {
    throw Object.assign(new Error(err?.message ?? "Failed to create task"), {
      status: err?.status,
      body: err?.body,
    });
  }
};

/**
 * updateTask
 * PUT /api/TaskManagement/tasks/:id
 * Accept either (id, payload) or payload containing id field (but here we expose payload with id)
 */
export const updateTask = async (task: {
  id: string;
  name?: string;
  descriptionPlain?: string;
  descriptionHtml?: string;
  assignedToIds?: Array<string | number>;
  dueDate?: string | null;
  priority?: 0 | 1 | 2;
  completed?: boolean;
}): Promise<Task | null> => {
  if (!task || !task.id) throw new Error("Task id required for update");
  try {
    const body: any = {};
    if (task.name !== undefined) {
      body.taskName = String(task.name);
      body.TaskName = String(task.name);
    }
    if (task.descriptionPlain !== undefined) body.descrPlainText = task.descriptionPlain;
    if (task.descriptionHtml !== undefined) body.descrFormattedText = task.descriptionHtml;
    if (task.assignedToIds !== undefined) body.assignedTo = (task.assignedToIds as any[]).map(String);
    if (task.dueDate !== undefined) body.dueDate = task.dueDate;
    if (task.priority !== undefined) body.priority = task.priority;
    if (task.completed !== undefined) body.completed = task.completed;

    const resp = await apiFetch(`/api/TaskManagement/tasks/${encodeURIComponent(String(task.id))}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const updated = resp.task ?? resp.data ?? resp.item ?? resp ?? null;
    if (updated && (updated._id || updated.id)) return mapBackendTask(updated);

    // fallback: try fetch fresh
    const fresh = await getTaskById(String(task.id));
    return fresh;
  } catch (err: any) {
    throw Object.assign(new Error(err?.message ?? "Failed to update task"), {
      status: err?.status,
      body: err?.body,
    });
  }
};

/**
 * deleteTask
 * DELETE /api/TaskManagement/tasks/:id
 */
export const deleteTask = async (id: string): Promise<void> => {
  if (!id) throw new Error("id required for delete");
  try {
    await apiFetch(`/api/TaskManagement/tasks/${encodeURIComponent(String(id))}`, {
      method: "DELETE",
    });
  } catch (err: any) {
    throw Object.assign(new Error(err?.message ?? "Failed to delete task"), {
      status: err?.status,
      body: err?.body,
    });
  }
};

/**
 * markComplete
 * PATCH /api/TaskManagement/tasks/:id/complete
 */
export const markComplete = async (id: string, completed = true): Promise<Task | null> => {
  if (!id) throw new Error("taskId required");
  try {
    const resp = await apiFetch(`/api/TaskManagement/tasks/${encodeURIComponent(String(id))}/complete`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed }),
    });
    const model = resp.task ?? resp.data ?? resp.item ?? resp ?? null;
    if (!model) return null;
    return mapBackendTask(model);
  } catch (err: any) {
    throw Object.assign(new Error(err?.message ?? "Failed to mark complete"), {
      status: err?.status,
      body: err?.body,
    });
  }
};

/* default export */
export default {
  getTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
  markComplete,
};
