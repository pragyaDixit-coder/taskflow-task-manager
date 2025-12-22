// src/routes/userManagement.routes.js
// Hinglish: yaha User list/admin ke sab routes define honge.
// This router is mounted in app as: app.use("/api", userManagementRoutes);

import express from "express";
import {
  getUserList,
  getUserModel,
  getUserLookupList,
  insertUser,
  updateUser,
  deleteUser,
  checkDuplicateEmailIDForUser,
} from "../controllers/userManagement.controller.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

/**
 * Small wrapper so controllers can be async and throw — errors will be forwarded to next()
 */
const wrap = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * IMPORTANT:
 * - Pehle yaha requireRole("admin") tha, jo normal users ko User Management se rok raha tha.
 * - Ab hum sirf authMiddleware laga rahe hain.
 * - Admin vs normal user ka difference controllers/services me handle hoga:
 *      - req.user.isAdmin === true  -> sab users/tasks dekh sakta hai
 *      - req.user.isAdmin === false -> sirf apne banaye hue (createdBy = req.user.id)
 *
 * Isse:
 * - UI me menu sabko dikh sakta hai
 * - Normal user ko list initially khali dikhegi,
 *   aur jese hi woh add karega, uske khud ke items list me aayenge.
 */

/* ------------------ Authenticated endpoints (Admin + normal User) ------------------ */

// 1) /GetList
// GET api/UserManagement/User/GetList?id=optionalId
// POST bhi allow — frontend kabhi filters body me bhej sakta hai
router.get(
  "/UserManagement/User/GetList",
  authMiddleware,
  wrap(getUserList)
);

router.post(
  "/UserManagement/User/GetList",
  authMiddleware,
  wrap(getUserList)
);

// 2) /GetModel/{ID}
// GET api/UserManagement/User/GetModel/:id
// Controller/service khud decide karega: Admin kisi ka bhi model dekh sakta hai,
// normal user sirf apne banaye hue user ka (agar business rule aisa hai).
router.get(
  "/UserManagement/User/GetModel/:id",
  authMiddleware,
  wrap(getUserModel)
);

// 3) /GetLookupList
// GET / POST api/UserManagement/User/GetLookupList
// Lookup lists (dropdown) sab signed-in users ke liye available.
router.get(
  "/UserManagement/User/GetLookupList",
  authMiddleware,
  wrap(getUserLookupList)
);

router.post(
  "/UserManagement/User/GetLookupList",
  authMiddleware,
  wrap(getUserLookupList)
);

// 4) /Insert
// POST api/UserManagement/User/Insert
// Ab normal user bhi naya user create kar sakta hai (agar tumhari business requirement hai).
router.post(
  "/UserManagement/User/Insert",
  authMiddleware,
  wrap(insertUser)
);

// 5) /Update
// PUT api/UserManagement/User/Update
// Service/controller ensure karega ki:
//   - Admin kisi ka bhi record update kar sakta hai
//   - Normal user sirf apna hi (ya apne banaye hue) update kare
router.put(
  "/UserManagement/User/Update",
  authMiddleware,
  wrap(updateUser)
);

// 6) /Delete/{ID}
// DELETE api/UserManagement/User/Delete/:id
router.delete(
  "/UserManagement/User/Delete/:id",
  authMiddleware,
  wrap(deleteUser)
);

// 7) /CheckDuplicateEmailID
// POST api/UserManagement/User/CheckDuplicateEmailID
// Body: { EmailID, ExcludeID }
router.post(
  "/UserManagement/User/CheckDuplicateEmailID",
  authMiddleware,
  wrap(checkDuplicateEmailIDForUser)
);

export default router;
