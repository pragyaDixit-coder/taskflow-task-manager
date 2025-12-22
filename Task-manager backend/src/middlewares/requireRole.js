// src/middlewares/requireRole.js
export const requireRole = (roleOrRoles) => {
  const roles = Array.isArray(roleOrRoles) ? roleOrRoles : [roleOrRoles];

  return async (req, res, next) => {
    try {
      // If auth middleware sets decoded payload in req.user.raw, prefer that
      const decoded = req.user?.raw ?? null;

      // If token did not include role, fetch user from DB (optional)
      let userRole = decoded?.role ?? decoded?.roles ?? null;

      if (!userRole) {
        // lazy-load user from DB (example using User model)
        // adjust import path as required
        const { User } = await import("../models/User.js");
        if (req.user?.id) {
          const u = await User.findById(req.user.id).lean().exec();
          userRole = u?.role ?? null;
        }
      }

      if (!userRole) {
        return res.status(403).json({ message: "Forbidden: role not found" });
      }

      // normalize and compare (case-insensitive)
      if (!roles.map(r => String(r).toLowerCase()).includes(String(userRole).toLowerCase())) {
        return res.status(403).json({ message: "Forbidden: insufficient privileges" });
      }

      return next();
    } catch (err) {
      console.error("[requireRole] error:", err);
      return res.status(500).json({ message: "Server error" });
    }
  };
};

export default requireRole;
