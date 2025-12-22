// src/App.tsx
import React, { useEffect, useState, useRef } from "react";
import AppRoutes from "./routes/AppRoutes";
import "react-toastify/dist/ReactToastify.css";
import { ToastContainer, toast } from "react-toastify";
import { getCurrentUser, clearCachedUser } from "./utils/storage";
import { CircularProgress, Box } from "@mui/material";

/**
 * App component
 * - On mount tries to hydrate current user from backend (cookie-first).
 * - Shows a full-screen loader while this check runs to avoid flashes.
 * - Listens to window focus to re-check auth state (useful during login/logout in another tab).
 *
 * Note: getCurrentUser() is expected to return null on unauthorized / no-session.
 * We intentionally avoid treating 401 as an exception — it's a valid "not logged in" state.
 *
 * DEV: Adds a global error + unhandledrejection listener in non-production to help debugging.
 */

const App: React.FC = () => {
  const [initializing, setInitializing] = useState(true);

  // Prevent the init effect from running multiple times (HMR / StrictMode / double-mount safety)
  const didInitRef = useRef(false);

  // simple debounce ref for focus-triggered checks (avoid spam)
  const focusTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (didInitRef.current) {
      // eslint-disable-next-line no-console
      console.debug("App init already run; skipping duplicate init.");
      setInitializing(false);
      return;
    }
    didInitRef.current = true;

    let mounted = true;

    const init = async () => {
      try {
        // Try to fetch current user from server (cookie-first).
        // getCurrentUser() should return user object or null.
        await getCurrentUser();
      } catch (err: any) {
        // Don't spam console for expected auth failures (401/Not authenticated).
        // Only show unexpected errors to the user for debugging.
        const status = err?.status;
        if (status && status !== 401) {
          // show a non-blocking toast so developer/tester notices unusual errors
          toast.error(`Auth check failed: ${err?.message ?? "Unknown error"}`, {
            autoClose: 5000,
          });
          // eslint-disable-next-line no-console
          console.error("Initial auth check error:", err);
        } else {
          // eslint-disable-next-line no-console
          console.debug("Initial auth check returned unauthenticated (expected):", err);
        }
      } finally {
        if (mounted) setInitializing(false);
      }
    };

    void init();

    // Re-check auth when window regains focus (useful if login happened in another tab)
    const onFocus = () => {
      // debounce focus calls to avoid rapid repeated checks
      try {
        if (focusTimeoutRef.current) {
          window.clearTimeout(focusTimeoutRef.current);
          focusTimeoutRef.current = null;
        }
        focusTimeoutRef.current = window.setTimeout(() => {
          // Clear cached user first so getCurrentUser actually fetches.
          clearCachedUser();
          void (async () => {
            try {
              await getCurrentUser();
            } catch {
              // ignore; components handle logged-out state
            }
          })();
        }, 300); // 300ms debounce
      } catch (e) {
        // ignore timer errors in older browsers
      }
    };

    window.addEventListener("focus", onFocus);

    /* ----------------- Dev-only global error handlers -----------------
       These listeners help capture uncaught errors and unhandled promise
       rejections during local development so you don't get a blank page.
       They are enabled only when MODE !== "production".
    ------------------------------------------------------------------- */
    let onError: ((ev: ErrorEvent) => void) | null = null;
    let onRejection: ((ev: PromiseRejectionEvent) => void) | null = null;

    if (import.meta.env.MODE !== "production") {
      onError = (ev: ErrorEvent) => {
        // show a small toast so developer notices; also log full detail to console
        // Note: avoid exposing sensitive info in UI
        toast.error("Unexpected error occurred (check console).", { autoClose: 6000 });
        // eslint-disable-next-line no-console
        console.error("Global error captured:", ev.error ?? ev.message, ev);
      };

      onRejection = (ev: PromiseRejectionEvent) => {
        toast.error("Unhandled promise rejection (check console).", { autoClose: 6000 });
        // eslint-disable-next-line no-console
        console.error("Unhandled promise rejection:", ev.reason);
      };

      window.addEventListener("error", onError);
      window.addEventListener("unhandledrejection", onRejection);
    }

    return () => {
      mounted = false;
      window.removeEventListener("focus", onFocus);
      if (onError) window.removeEventListener("error", onError);
      if (onRejection) window.removeEventListener("unhandledrejection", onRejection);
      if (focusTimeoutRef.current) {
        window.clearTimeout(focusTimeoutRef.current);
        focusTimeoutRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (initializing) {
    // Full-screen loader while initial auth check runs
    return (
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: "#f3f6f8",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <>
      <div className="app-background">
       {/* your routes / pages */}
      <AppRoutes />
      <ToastContainer position="top-right" />
       </div>
       
    </>
  );
};

export default App;
