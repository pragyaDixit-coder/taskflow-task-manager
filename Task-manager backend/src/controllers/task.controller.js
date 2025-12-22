// controllers/task.controller.js
import { validationResult } from "express-validator";
import * as taskService from "../services/task.service.js";

function handleValidationErrors(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return true;
  }
  return false;
}

/**
 * POST /api/TaskManagement/Task/Create
 */
export const create = async (req, res, next) => {
  if (handleValidationErrors(req, res)) return;
  try {
    const payload = {
      taskName:
        req.body.taskName ??
        req.body.TaskName ??
        req.body.name ??
        req.body.Name,
      descrPlainText:
        req.body.descrPlainText ??
        req.body.DescrPlainText ??
        req.body.descriptionPlain ??
        req.body.description ??
        "",
      descrFormattedText:
        req.body.descrFormattedText ??
        req.body.DescrFormattedText ??
        req.body.descriptionHtml ??
        req.body.descriptionFormatted ??
        "",
      assignedTo:
        req.body.assignedTo ??
        req.body.AssignedTo ??
        req.body.assignedToIds ??
        [],
      dueDate: req.body.dueDate ?? req.body.DueDate ?? null,
      priority:
        typeof req.body.priority !== "undefined"
          ? Number(req.body.priority)
          : req.body.Priority ?? 0,
      completed: !!req.body.completed,
    };

    // 💡 IMPORTANT: pure user object pass kar rahe hain, sirf id nahi
    const currentUser = req.user || null;

    const created = await taskService.createTask(payload, currentUser);
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/TaskManagement/Task/Update/:id
 */
export const update = async (req, res, next) => {
  if (handleValidationErrors(req, res)) return;
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ message: "Task id is required" });

    const payload = req.body || {};
    const currentUser = req.user || null;

    const updated = await taskService.updateTask(id, payload, currentUser);
    if (!updated) return res.status(404).json({ message: "Task not found" });

    res.json(updated);
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/TaskManagement/Task/Delete/:id
 */
export const remove = async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ message: "Task id is required" });

    const currentUser = req.user || null;

    const deleted = await taskService.deleteTask(id, currentUser);
    if (!deleted) return res.status(404).json({ message: "Task not found" });

    res.json({ message: "Deleted" });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/TaskManagement/Task/Get/:id
 */
export const getById = async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ message: "Task id is required" });

    const currentUser = req.user || null;

    const task = await taskService.getTaskById(id, currentUser);
    if (!task) return res.status(404).json({ message: "Task not found" });

    res.json(task);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/TaskManagement/Task/List
 * query: page, limit, completed, priority, assignedTo, dueDateFrom, dueDateTo, search
 */
export const list = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      Math.max(1, parseInt(req.query.limit, 10) || 10),
      200
    );

    const filters = {
      completed:
        typeof req.query.completed !== "undefined"
          ? req.query.completed === "true"
            ? true
            : req.query.completed === "false"
            ? false
            : undefined
          : undefined,
      priority:
        typeof req.query.priority !== "undefined"
          ? Number(req.query.priority)
          : undefined,
      assignedTo: req.query.assignedTo ?? undefined,
      dueDateFrom: req.query.dueDateFrom ?? undefined,
      dueDateTo: req.query.dueDateTo ?? undefined,
      search: req.query.search ?? undefined,
    };

    const currentUser = req.user || null;

    // 🔑 Yahan currentUser pass ho raha hai:
    //   - Admin  => sab tasks
    //   - User   => sirf apne createdBy wale tasks
    const result = await taskService.listTasks(
      { page, limit, filters },
      currentUser
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/TaskManagement/Task/MarkComplete/:id
 */
export const markComplete = async (req, res, next) => {
  if (handleValidationErrors(req, res)) return;
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ message: "Task id is required" });

    const completed =
      typeof req.body.completed !== "undefined"
        ? !!req.body.completed
        : true;

    const currentUser = req.user || null;

    const updated = await taskService.markComplete(
      id,
      completed,
      currentUser
    );
    if (!updated) return res.status(404).json({ message: "Task not found" });

    res.json(updated);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/TaskManagement/Task/GetAssignedUsersLookup
 */
export const getAssignedUsersLookup = async (req, res, next) => {
  try {
    const users = await taskService.getAssignedUsersLookup();

    // normalize variety of shapes (mongoose docs or plain objects)
    const lookup = (users || []).map((u) => {
      const id =
        u.id ??
        u._id ??
        (u._id && u._id.toString && u._id.toString()) ??
        "";
      const name =
        (
          u.name ??
          [u.firstName, u.lastName].filter(Boolean).join(" ") ??
          u.userName ??
          u.username ??
          ""
        )
          .toString()
          .trim() || String(id);

      return {
        id: String(id),
        name,
        email: u.email ?? undefined,
        isDeleted: !!u.isDeleted,
      };
    });

    res.json(lookup);
  } catch (err) {
    next(err);
  }
};
