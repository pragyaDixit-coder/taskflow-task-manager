// services/task.service.js
import mongoose from "mongoose";
import Task from "../models/task.model.js";

// Try multiple import shapes for User model (support default or named export)
import * as UserModule from "../models/User.js";
const User = UserModule?.default ?? UserModule?.User ?? UserModule;

/**
 * Helper: coerce value to string if defined
 * @param {*} v
 * @returns {string}
 */
const toStringIfExists = (v) =>
  v === null || v === undefined ? "" : String(v);

/* ------------------------ Role helper ------------------------ */

function isAdminUser(currentUser) {
  if (!currentUser) return false;

  if (currentUser.isAdmin === true) return true;

  const role =
    (currentUser.role && String(currentUser.role)) ||
    (Array.isArray(currentUser.roles) && currentUser.roles[0]) ||
    "";

  if (role && String(role).trim().toLowerCase() === "admin") return true;

  if (currentUser.is_superuser === true) return true;

  return false;
}

/**
 * Helper: normalize currentUser / userId -> { id, isAdmin }
 */
function normalizeUserIdAndAdmin(userOrId) {
  if (!userOrId) return { userId: null, isAdmin: false, currentUser: null };

  if (typeof userOrId === "object") {
    const currentUser = userOrId;
    const userId =
      currentUser.id ??
      currentUser._id ??
      currentUser.userId ??
      currentUser.userID ??
      null;
    return {
      userId: userId ? String(userId) : null,
      isAdmin: isAdminUser(currentUser),
      currentUser,
    };
  }

  return {
    userId: String(userOrId),
    isAdmin: false,
    currentUser: null,
  };
}

/* ------------------------ Create / Update / Delete ------------------------ */

export async function createTask(payload, userOrUserId) {
  try {
    const { userId } = normalizeUserIdAndAdmin(userOrUserId);

    const doc = new Task({
      ...payload,
      createdBy: userId ?? null,
      updatedBy: userId ?? null,
    });
    const saved = await doc.save();
    return saved;
  } catch (err) {
    console.error("createTask error:", err);
    throw new Error(err?.message ?? "Failed to create task");
  }
}

export async function updateTask(id, payload, userOrUserId) {
  try {
    const { userId, isAdmin } = normalizeUserIdAndAdmin(userOrUserId);

    const existing = await Task.findById(id).exec();
    if (!existing) {
      throw new Error("Task not found");
    }

    // Non-admin sirf apna hi task update kar sake
    if (!isAdmin && userId && existing.createdBy) {
      if (String(existing.createdBy) !== String(userId)) {
        const err = new Error("Forbidden: cannot update this task");
        err.statusCode = 403;
        throw err;
      }
    }

    const update = {
      ...payload,
      updatedBy: userId ?? existing.updatedBy ?? null,
    };

    const updated = await Task.findByIdAndUpdate(id, update, {
      new: true,
    });
    return updated;
  } catch (err) {
    console.error("updateTask error:", err);
    throw new Error(err?.message ?? "Failed to update task");
  }
}

export async function deleteTask(id, userOrUserId = null) {
  try {
    const { userId, isAdmin } = normalizeUserIdAndAdmin(userOrUserId);

    const existing = await Task.findById(id).exec();
    if (!existing) {
      throw new Error("Task not found");
    }

    // Non-admin sirf apna hi task delete kar sake
    if (!isAdmin && userId && existing.createdBy) {
      if (String(existing.createdBy) !== String(userId)) {
        const err = new Error("Forbidden: cannot delete this task");
        err.statusCode = 403;
        throw err;
      }
    }

    // Hard delete (agar soft delete chahiye to yahan isDeleted=true kar sakti ho)
    return await Task.findByIdAndDelete(id);
  } catch (err) {
    console.error("deleteTask error:", err);
    throw new Error(err?.message ?? "Failed to delete task");
  }
}

/* ------------------------ Get single task ------------------------ */

export async function getTaskById(id, currentUser = null) {
  try {
    if (!id) return null;

    const task = await Task.findById(id)
      .populate("assignedTo", "firstName lastName email")
      .populate("createdBy", "firstName lastName")
      .populate("updatedBy", "firstName lastName")
      .populate("completedByUserId", "firstName lastName")
      .lean();

    if (!task) return null;

    // Access control (optional): agar currentUser diya ho to check
    if (currentUser) {
      const isAdmin = isAdminUser(currentUser);
      const currentId = String(
        currentUser.id ??
          currentUser._id ??
          currentUser.userId ??
          currentUser.userID ??
          ""
      );

      if (!isAdmin && currentId) {
        const createdByStr = task.createdBy
          ? String(task.createdBy._id ?? task.createdBy)
          : null;

        const isCreator = createdByStr === currentId;

        const isAssigned =
          Array.isArray(task.assignedTo) &&
          task.assignedTo.some((u) =>
            currentId
              ? String(u._id ?? u.id ?? "").toString() === currentId
              : false
          );

        if (!isCreator && !isAssigned) {
          const err = new Error("Forbidden: cannot view this task");
          err.statusCode = 403;
          throw err;
        }
      }
    }

    // Normalize populated fields to plain arrays/strings where helpful
    if (Array.isArray(task.assignedTo) && task.assignedTo.length > 0) {
      task.assignedTo = task.assignedTo.map((u) => ({
        id: toStringIfExists(u._id ?? u.id),
        firstName: u.firstName ?? "",
        lastName: u.lastName ?? "",
        email: u.email ?? "",
      }));
    }

    return task;
  } catch (err) {
    console.error("getTaskById error:", err);
    throw new Error(err?.message ?? "Failed to fetch task");
  }
}

/* ------------------------ List / search tasks ------------------------ */
/**
 * listTasks({ page, limit, filters }, currentUser?)
 * filters: { completed, priority, assignedTo, dueDateFrom, dueDateTo, search }
 *
 * currentUser:
 *   - Admin  => sab tasks (filters ke sath)
 *   - User   => sirf apne banaye hue tasks (createdBy = currentUser.id)
 */
export async function listTasks(
  { page = 1, limit = 10, filters = {} } = {},
  currentUser = null
) {
  try {
    const query = {
      isDeleted: { $ne: true },
    };

    // Role based filter: non-admin user => sirf apne tasks
    if (currentUser) {
      const isAdmin = isAdminUser(currentUser);
      const userId =
        currentUser.id ??
        currentUser._id ??
        currentUser.userId ??
        currentUser.userID ??
        null;

      if (!isAdmin && userId) {
        query.createdBy = mongoose.Types.ObjectId.isValid(String(userId))
          ? new mongoose.Types.ObjectId(String(userId))
          : String(userId);
      }
    }

    if (typeof filters.completed !== "undefined")
      query.completed = filters.completed;
    if (typeof filters.priority !== "undefined")
      query.priority = filters.priority;

    // assignedTo may be an id string — only add $in if valid ObjectId
    if (filters.assignedTo) {
      try {
        if (mongoose.Types.ObjectId.isValid(String(filters.assignedTo))) {
          query.assignedTo = {
            $in: [mongoose.Types.ObjectId(String(filters.assignedTo))],
          };
        } else {
          query.assignedTo = { $in: [String(filters.assignedTo)] };
        }
      } catch (err) {
        console.warn(
          "listTasks: invalid assignedTo filter, ignoring",
          filters.assignedTo
        );
      }
    }

    if (filters.dueDateFrom || filters.dueDateTo) {
      query.dueDate = {};
      if (filters.dueDateFrom)
        query.dueDate.$gte = new Date(filters.dueDateFrom);
      if (filters.dueDateTo) query.dueDate.$lte = new Date(filters.dueDateTo);
    }

    if (filters.search) {
      // search in taskName or description fields
      query.$or = [
        { taskName: { $regex: filters.search, $options: "i" } },
        { descrPlainText: { $regex: filters.search, $options: "i" } }, // fixed field name
      ];
    }

    const skip = Math.max(
      0,
      (Number(page) - 1) * Number(limit || 10)
    );

    const [items, total] = await Promise.all([
      Task.find(query)
        .sort({ dueDate: 1, priority: -1, createdOn: -1 })
        .skip(skip)
        .limit(Number(limit || 10))
        .populate("assignedTo", "firstName lastName email")
        .lean(),
      Task.countDocuments(query),
    ]);

    // Normalize items: convert ObjectId fields to strings and map assignedTo
    const normalizedItems = (items || []).map((t) => {
      const item = { ...t };
      item._id = toStringIfExists(item._id);
      item.id = toStringIfExists(item.id ?? item._id);
      if (Array.isArray(item.assignedTo)) {
        item.assignedTo = item.assignedTo.map((u) => ({
          id: toStringIfExists(u._id ?? u.id),
          firstName: u.firstName ?? "",
          lastName: u.lastName ?? "",
          email: u.email ?? "",
        }));
      }
      return item;
    });

    return {
      items: normalizedItems,
      total: Number(total || 0),
      page: Number(page || 1),
      pages: Math.max(
        1,
        Math.ceil((Number(total) || 0) / Number(limit || 10))
      ),
    };
  } catch (err) {
    console.error("listTasks error:", err);
    throw new Error(err?.message ?? "Failed to list tasks");
  }
}

/* ------------------------ Mark complete ------------------------ */

export async function markComplete(
  id,
  completed,
  completedByUserId,
  currentUser = null
) {
  try {
    const { userId } = normalizeUserIdAndAdmin(
      currentUser ?? completedByUserId
    );

    const update = {
      completed: !!completed,
      completedByUserId: completed ? userId : null,
      completedOn: completed ? new Date() : null,
      updatedBy: userId ?? null,
    };
    const updated = await Task.findByIdAndUpdate(id, update, {
      new: true,
    }).lean();
    return updated;
  } catch (err) {
    console.error("markComplete error:", err);
    throw new Error(err?.message ?? "Failed to mark complete");
  }
}

/* ------------------------ Assigned users lookup ------------------------ */

export async function getAssignedUsersLookup() {
  try {
    // defensive: ensure we have a User model
    if (!User) {
      console.error(
        "getAssignedUsersLookup: User model is not available (import issue)."
      );
      throw new Error("User model not available");
    }

    // limit fields for lookup and return lean array
    const users = await User.find(
      {},
      { _id: 1, firstName: 1, lastName: 1, email: 1, isDeleted: 1 }
    ).lean();

    // normalize mapping to { id, firstName, lastName, email, isDeleted, name }
    return (users || []).map((u) => {
      const id = toStringIfExists(u._id ?? u.id ?? "");
      const firstName = u.firstName ?? "";
      const lastName = u.lastName ?? "";
      return {
        id,
        firstName,
        lastName,
        name: `${firstName} ${lastName}`.trim() || String(id),
        email: u.email ?? "",
        isDeleted: !!u.isDeleted,
      };
    });
  } catch (err) {
    console.error("getAssignedUsersLookup error:", err);
    throw new Error(err?.message ?? "Failed to load assigned users lookup");
  }
}
