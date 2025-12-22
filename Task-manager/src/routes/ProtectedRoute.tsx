// src/routes/ProtectedRoute.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { CircularProgress, Box } from "@mui/material";
import { getCurrentUser } from "../utils/storage";
import type { AppUser } from "../utils/storage";

interface ProtectedRouteProps {
  element: JSX.Element;
  /**
   * Optional list of allowed roles (case-insensitive).
   * If omitted -> any authenticated user is allowed.
   * Example: roles={['admin']} will only allow admin users.
   */
  roles?: string[] | undefined;
  /**
   * Optional redirect path when user is authenticated but not authorized.
   * Defaults to '/' (home).
   */
  unauthorizedRedirectTo?: string;
}

/**
 * ProtectedRoute
 * - Waits for getCurrentUser() (cookie-first) to resolve.
 * - While resolving, shows a small loader to avoid flashes / blank pages.
 * - If authenticated (user object returned) -> if roles provided checks role.
 *   - If role allowed -> render element.
 *   - If role not allowed -> redirect to unauthorizedRedirectTo (default '/').
 * - Otherwise redirect to /login.
 *
 * Usage examples:
 *  - <ProtectedRoute element={<Dashboard />} />
 *    -> any logged-in user can access
 *
 *  - <ProtectedRoute element={<UsersList />} roles={['admin']} unauthorizedRedirectTo="/home" />
 *    -> only admin role can access; others will be redirected to /home
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  element,
  roles,
  unauthorizedRedirectTo = "/",
}) => {
  const [checking, setChecking] = useState<boolean>(true);
  const [user, setUser] = useState<AppUser | null>(null);

  useEffect(() => {
    let mounted = true;

    const check = async () => {
      try {
        const u = await getCurrentUser();
        if (!mounted) return;
        setUser(u ?? null);
      } catch (err) {
        // storage logs details already; treat as unauthenticated
        if (mounted) setUser(null);
      } finally {
        if (mounted) setChecking(false);
      }
    };

    void check();

    return () => {
      mounted = false;
    };
  }, []);

  // Show a small centered loader while verifying session/cookie
  if (checking) {
    return (
      <Box
        sx={{
          minHeight: "60vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <CircularProgress size={28} />
      </Box>
    );
  }

  // If not authenticated -> redirect to login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // If no role restriction -> allow access
  if (!roles || roles.length === 0) {
    return element;
  }

  // Compute allowed set once (case-insensitive)
  const allowed = useMemo(() => {
    const userRole = (user.role ?? "").toString().toLowerCase();
    const normalized = roles.map((r) => String(r).toLowerCase());
    return normalized.includes(userRole);
  }, [roles, user.role]);

  // If authorized -> render requested element. Otherwise redirect to unauthorized page.
  return allowed ? element : <Navigate to={unauthorizedRedirectTo} replace />;
};

export default ProtectedRoute;
