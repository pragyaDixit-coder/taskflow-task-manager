// frontend/api/tasks.api.ts
// Robust Task API client (TypeScript). Compatible with legacy /Task/* backend endpoints.
// - Defensive parsing of list responses
// - Request helper ensures JSON bodies are properly stringified (avoids TS BodyInit errors)
// - Exports both named functions and default object

type Maybe<T> = T | null;

const DEFAULT_BASE = (import.meta.env.VITE_API_BASE_URL as string) || "http://localhost:5000";
const API_PREFIX = "/api/TaskManagement";
const BASE = `${DEFAULT_BASE.replace(/\/$/, "")}${API_PREFIX}`;

/** Try reading token from several places (localStorage / cookies). */
function getAuthToken(): Maybe<string> {
  try {
    if (typeof localStorage !== "undefined") {
      const fromStorage =
        localStorage.getItem("authToken") ||
        localStorage.getItem("token") ||
        localStorage.getItem("session");
      if (fromStorage) return fromStorage;
    }

    if (typeof document !== "undefined") {
      const cookies = document.cookie.split(";").map((s) => s.trim());
      for (const c of cookies) {
        if (c.startsWith("session=") || c.startsWith("token=")) {
          return decodeURIComponent((c.split("=")[1] || ""));
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Low-level fetch wrapper
 * - ensures JSON Content-Type when appropriate
 * - stringifies non-FormData bodies to avoid BodyInit typing/runtime issues
 */
async function request<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${BASE}${cleanPath}`;

  const token = getAuthToken();
  const headers: Record<string, string> = { ...(options.headers as Record<string, string> || {}) };

  const bodyIsFormData = (options.body instanceof FormData);

  if (!bodyIsFormData && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  if (token && !headers["Authorization"]) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const opts: RequestInit = {
    credentials: "include",
    ...options,
    headers,
  };

  // Ensure body is a valid BodyInit for fetch (string or FormData)
  if (opts.body && headers["Content-Type"] === "application/json" && !(opts.body instanceof FormData) && typeof opts.body !== "string") {
    try {
      opts.body = JSON.stringify(opts.body) as unknown as BodyInit;
    } catch {
      // fallback: convert to string
      opts.body = String(opts.body) as unknown as BodyInit;
    }
  }

  const res = await fetch(url, opts);
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const err: any = new Error((data && data.message) || res.statusText || "Request failed");
    err.status = res.status;
    err.body = data;
    throw err;
  }

  return data as T;
}

/* ---------------- TaskItem type (broad to handle different backend shapes) ---------------- */
export interface TaskItem {
  _id?: string;
  id?: string;
  TaskID?: string | number;
  taskName?: string;
  name?: string;
  TaskName?: string;

  descriptionPlain?: string;
  descriptionHtml?: string;
  descrPlainText?: string;
  descrFormattedText?: string;

  assignedToIds?: Array<number | string>;
  assignedTo?: string[]; // alternate shape
  TaskAssignedUser?: Array<{ AssignedUserID?: string | number }>;

  dueDate?: string | null;
  DueDate?: string | null;

  priority?: number;
  Priority?: number;

  completed?: boolean;
  Completed?: boolean;

  createdById?: string | number | null;
  createdAt?: string | number | Date;
  updatedAt?: string | number | Date;
  CreatedOn?: string;
  UpdatedOn?: string;
}

/* ---------------------- API functions ---------------------- */

/**
 * listTasks
 * - Calls legacy endpoint `/Task/GetList` (POST {}) which many backends use
 * - Normalizes numerous wrapper shapes into { items, total, page, pages }
 */
export async function listTasks(opts: {
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
  signal?: AbortSignal;
} = {}) {
  const { page = 1, limit = 10, filters = {}, signal } = opts;

  // Build simple payload expected by some backends; if your backend expects query params
  // change to request(`/tasks?....`, { method: 'GET' }) — but many older TaskManagement use POST {}.
  const payload: any = {
    page,
    limit,
    ...filters,
  };

  const raw: any = await request<any>(`/Task/GetList`, { method: "POST", body: payload as any, signal });

  // Defensive normalization into items array
  let items: TaskItem[] = [];

  if (Array.isArray(raw)) {
    items = raw as TaskItem[];
  } else if (raw == null) {
    items = [];
  } else {
    // common wrapper shapes
    if (Array.isArray(raw.data)) items = raw.data;
    else if (Array.isArray(raw.items)) items = raw.items;
    else if (Array.isArray(raw.Result)) items = raw.Result;
    else if (Array.isArray(raw.results)) items = raw.results;
    else if (Array.isArray(raw.rows)) items = raw.rows;
    else if (Array.isArray(raw.Items)) items = raw.Items;
    else if (Array.isArray(raw.List)) items = raw.List;
    else if (Array.isArray(raw.Results)) items = raw.Results;
    else if (Array.isArray(raw.result)) items = raw.result;
    else if (Array.isArray(raw.data?.items)) items = raw.data.items;
    else if (Array.isArray(raw.Result?.items)) items = raw.Result.items;
    else {
      // maybe single object representing one task
      const looksLikeItem = raw && (raw.TaskID || raw.id || raw._id || raw.TaskName || raw.name);
      if (looksLikeItem) items = [raw as TaskItem];
      else items = [];
    }
  }

  // try to extract metadata
  const total =
    typeof raw?.total === "number" ? raw.total :
    typeof raw?.Total === "number" ? raw.Total :
    typeof raw?.count === "number" ? raw.count :
    items.length;

  const currentPage = typeof raw?.page === "number" ? raw.page : page;
  const pages = typeof raw?.pages === "number" ? raw.pages : Math.max(1, Math.ceil(total / limit));

  return { items, total, page: currentPage, pages };
}

/** getTask: Get single model (calls legacy /Task/GetModel/:id) */
export async function getTask(taskId: string, { signal }: { signal?: AbortSignal } = {}) {
  if (!taskId) throw new Error("taskId required");
  // many backends expose /Task/GetModel/:id
  return request<TaskItem>(`/Task/GetModel/${encodeURIComponent(taskId)}`, { method: "GET", signal });
}

/** createTask: POST /Task/Insert */
export async function createTask(payload: Partial<TaskItem>, { signal }: { signal?: AbortSignal } = {}) {
  const body: any = {
    TaskName: payload.taskName ?? payload.name ?? payload.TaskName ?? "",
    DescrPlainText: payload.descriptionPlain ?? payload.descrPlainText ?? "",
    DescrFormattedText: payload.descriptionHtml ?? payload.descrFormattedText ?? "",
    AssignedTo: payload.assignedToIds ? payload.assignedToIds.map(String) : payload.assignedTo ?? [],
    DueDate: payload.dueDate ?? payload.DueDate ?? null,
    Priority: payload.priority ?? payload.Priority ?? 0,
    Completed: payload.completed ?? payload.Completed ?? false,
  };

  return request<TaskItem>(`/Task/Insert`, { method: "POST", body: body as any, signal });
}

/**
 * updateTask
 * - Supports two forms:
 *   - updateTask(id, payload)
 *   - updateTask(payloadWithId)
 * - Calls legacy /Task/Update (PUT) which expects TaskID in body
 */
export async function updateTask(taskIdOrPayload: string | Partial<TaskItem>, payloadMaybe?: Partial<TaskItem>, { signal }: { signal?: AbortSignal } = {}) {
  if (typeof taskIdOrPayload === "string") {
    const id = taskIdOrPayload;
    const payload = payloadMaybe || {};
    const body: any = {
      TaskID: String(id),
      TaskName: payload.taskName ?? payload.name,
      DescrPlainText: payload.descriptionPlain,
      DescrFormattedText: payload.descriptionHtml,
      AssignedTo: payload.assignedToIds ? payload.assignedToIds.map(String) : payload.assignedTo ?? undefined,
      DueDate: payload.dueDate ?? payload.DueDate,
      Priority: payload.priority ?? payload.Priority,
      Completed: payload.completed ?? payload.Completed,
    };
    return request<TaskItem>(`/Task/Update`, { method: "PUT", body: body as any, signal });
  } else {
    const payload = taskIdOrPayload as Partial<TaskItem>;
    const id = payload.id ?? payload._id ?? payload.TaskID;
    if (!id) throw new Error("taskId required in payload");
    const body: any = {
      TaskID: String(id),
      TaskName: payload.taskName ?? payload.name,
      DescrPlainText: payload.descriptionPlain,
      DescrFormattedText: payload.descriptionHtml,
      AssignedTo: payload.assignedToIds ? payload.assignedToIds.map(String) : payload.assignedTo ?? undefined,
      DueDate: payload.dueDate ?? payload.DueDate,
      Priority: payload.priority ?? payload.Priority,
      Completed: payload.completed ?? payload.Completed,
    };
    return request<TaskItem>(`/Task/Update`, { method: "PUT", body: body as any, signal });
  }
}

/** deleteTask */
export async function deleteTask(taskId: string, { signal }: { signal?: AbortSignal } = {}) {
  if (!taskId) throw new Error("taskId required");
  return request<{ message?: string }>(`/Task/Delete/${encodeURIComponent(taskId)}`, { method: "DELETE", signal });
}

/** markComplete (convenience) - uses /Task/Update with Completed flag */
export async function markComplete(taskId: string, completed = true, { signal }: { signal?: AbortSignal } = {}) {
  if (!taskId) throw new Error("taskId required");
  const body = { TaskID: taskId, Completed: completed };
  return request<TaskItem>(`/Task/Update`, { method: "PUT", body: body as any, signal });
}

/** getAssignedUsersLookup - legacy endpoint */
export async function getAssignedUsersLookup({ signal }: { signal?: AbortSignal } = {}) {
  // many backends expose /Task/GetAssignedUsersLookup; return normalized array
  const raw = await request<any>(`/Task/GetAssignedUsersLookup`, { method: "GET", signal });
  // If server returned array directly, use it; otherwise attempt to pull common wrappers
  if (Array.isArray(raw)) return raw as Array<{ id: string; name: string; email?: string }>;
  if (Array.isArray(raw.data)) return raw.data;
  if (Array.isArray(raw.items)) return raw.items;
  // if already mapped objects like { _id, firstName, lastName } -> normalize
  if (Array.isArray(raw?.rows)) return raw.rows;
  // Fallback: if it's object map -> try to build array
  if (raw && typeof raw === "object") {
    // If entries look like DB user models with _id/firstName/lastName
    const maybeUsers = (raw.users || raw.result || raw.data)?.map?.((u: any) => u) ?? null;
    if (Array.isArray(maybeUsers)) return maybeUsers;
  }
  return [];
}

/** default export convenience */
const tasksApi = {
  listTasks,
  getTask,
  createTask,
  updateTask,
  deleteTask,
  markComplete,
  getAssignedUsersLookup,
};

export default tasksApi;
