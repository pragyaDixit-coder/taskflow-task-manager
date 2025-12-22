// routes/task.routes.js
import express from "express";
import * as taskController from "../controllers/task.controller.js";
import * as validator from "../validators/task.validator.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

/**
 * Canonical endpoints (preferred):
 *   GET    /tasks
 *   GET    /tasks/lookup/users
 *   POST   /tasks
 *   GET    /tasks/:id
 *   PUT    /tasks/:id
 *   DELETE /tasks/:id
 *   PATCH  /tasks/:id/complete
 *
 * NOTE:
 *  - sab routes sirf authMiddleware se protected hain (koई requireRole("admin") nahi)
 *  - Admin vs normal user ka data access task.service.js me handle hota hai:
 *      - Admin  => sab tasks
 *      - User   => sirf createdBy = currentUser.id
 */

// 🔹 Canonical routes
router.get("/tasks", authMiddleware, taskController.list);

router.get(
  "/tasks/lookup/users",
  authMiddleware,
  taskController.getAssignedUsersLookup
);

router.post(
  "/tasks",
  authMiddleware,
  validator.createTask,
  taskController.create
);

router.get("/tasks/:id", authMiddleware, taskController.getById);

router.put(
  "/tasks/:id",
  authMiddleware,
  validator.updateTask,
  taskController.update
);

router.delete("/tasks/:id", authMiddleware, taskController.remove);

router.patch(
  "/tasks/:id/complete",
  authMiddleware,
  validator.markComplete,
  taskController.markComplete
);

/* --------------------- Legacy / compatibility routes ----------------------
   Purane frontend paths ke liye explicit aliases.
   Yahaan bhi sirf authMiddleware use ho raha hai; koi admin-only guard nahi.
   ------------------------------------------------------------------------*/

// Legacy: GET /Task/GetAssignedUsersLookup
router.get(
  "/Task/GetAssignedUsersLookup",
  authMiddleware,
  taskController.getAssignedUsersLookup
);

// Legacy: POST /Task/GetList  -> canonical list handler (body ignore, query use)
router.post("/Task/GetList", authMiddleware, taskController.list);

// Legacy: POST /Task/Insert  -> create
router.post(
  "/Task/Insert",
  authMiddleware,
  validator.createTask,
  taskController.create
);

// Legacy: PUT /Task/Update  (id body me) -> normalize and call update
router.put(
  "/Task/Update",
  authMiddleware,
  validator.updateTask,
  (req, res, next) => {
    try {
      // Accept TaskID, id, _id in body. Normalize to req.params.id
      const bodyId = req.body?.TaskID ?? req.body?.id ?? req.body?._id;
      if (!bodyId) {
        return res.status(400).json({
          message:
            "Task id required (provide TaskID or id in request body)",
        });
      }
      req.params.id = String(bodyId);
      return taskController.update(req, res, next);
    } catch (err) {
      return next(err);
    }
  }
);

// Legacy: PUT /Task/Update/:id  (id path me)
router.put(
  "/Task/Update/:id",
  authMiddleware,
  validator.updateTask,
  (req, res, next) => {
    return taskController.update(req, res, next);
  }
);

// Legacy: DELETE /Task/Delete/:id -> delete
router.delete("/Task/Delete/:id", authMiddleware, (req, res, next) => {
  return taskController.remove(req, res, next);
});

// Legacy: PATCH /Task/MarkComplete/:id -> mark complete
router.patch(
  "/Task/MarkComplete/:id",
  authMiddleware,
  validator.markComplete,
  (req, res, next) => {
    return taskController.markComplete(req, res, next);
  }
);

export default router;
