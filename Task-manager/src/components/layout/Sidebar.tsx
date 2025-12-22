// src/components/layout/Sidebar.tsx
import React, { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import {
  Home,
  Users,
  ClipboardList,
  Globe,
  MapPin,
  Settings,
  Menu,
  LayoutDashboard,
} from "lucide-react";
import { IconButton, Tooltip } from "@mui/material";
import storage from "../../utils/storage";

// 👉 Link type jisme adminOnly optional hai
type SidebarLink = {
  name: string;
  icon: JSX.Element;
  path: string;
  adminOnly?: boolean;
};

const Sidebar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(true);

  // derived role (null = no role found / not logged in, 'admin'|'user'|other strings when known)
  const [roleDerived, setRoleDerived] = useState<string | null>(null);
  // whether we have any authenticated user (cached or fetched)
  const [hasUser, setHasUser] = useState<boolean | null>(null);
  // loading flag while trying to determine user/role
  const [loading, setLoading] = useState(true);

  // Defensive role derivation supporting various shapes
  function deriveRoleFromUser(u: any): string | null {
    if (!u || typeof u !== "object") return null;

    // Straightforward fields
    const candidates = [
      u.role,
      u.roleName,
      u.user?.role,
      u.user?.roleName,
      u.userType,
      u.user?.userType,
      u.role?.name,
    ];

    for (const c of candidates) {
      if (typeof c === "string" && c.trim()) {
        return c.trim().toLowerCase();
      }
    }

    // roles array
    const rolesArr =
      (Array.isArray(u.roles) && u.roles.length && u.roles) ||
      (Array.isArray(u.user?.roles) && u.user.roles.length && u.user.roles) ||
      null;

    if (rolesArr) {
      const normalized = rolesArr
        .map((r: any) => (r == null ? "" : String(r).trim().toLowerCase()))
        .filter(Boolean);
      if (normalized.includes("admin")) return "admin";
      if (normalized.length) return normalized[0];
    }

    // boolean flags
    if (typeof u.isAdmin === "boolean" && u.isAdmin) return "admin";
    if (typeof u.is_superuser === "boolean" && u.is_superuser) return "admin";
    if (typeof u.is_staff === "boolean" && u.is_staff) return "admin";

    // nested user flags
    if (typeof u.user?.isAdmin === "boolean" && u.user.isAdmin) return "admin";

    return null;
  }

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoading(true);

        // 1) Fast path: cached current user (if previously loaded)
        let cached: any = null;
        try {
          cached = await (storage as any).getCurrentUser();
        } catch (e) {
          cached = null;
        }

        if (mounted && cached) {
          const r = deriveRoleFromUser(cached);
          if (mounted) {
            setRoleDerived(r);
            setHasUser(true);
            setLoading(false);
          }
          // still attempt to refresh in background but don't block UI
          try {
            const fetched = await (storage as any).fetchCurrentUserFromServer();
            if (!mounted) return;
            if (fetched) {
              const r2 = deriveRoleFromUser(fetched);
              setRoleDerived(r2);
              setHasUser(true);
            }
          } catch {
            // ignore background fetch errors
          }
          return;
        }

        // 2) If no cached user, try cookie-first server fetch
        try {
          const fetched = await (storage as any).fetchCurrentUserFromServer();
          if (!mounted) return;
          if (fetched) {
            const r = deriveRoleFromUser(fetched);
            setRoleDerived(r);
            setHasUser(true);
            setLoading(false);
            return;
          }
        } catch (err) {
          // fetch may throw for 401/500; we'll handle below
        }

        // 3) No user found
        if (mounted) {
          setRoleDerived(null);
          setHasUser(false);
          setLoading(false);
        }
      } catch (err) {
        // keep UI usable; log for dev
        // eslint-disable-next-line no-console
        console.warn("Sidebar: failed to determine role/user", err);
        if (mounted) {
          setRoleDerived(null);
          setHasUser(false);
          setLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  // base links — ab Users adminOnly nahi hai, sab logged-in users ko dikhega
  const links: SidebarLink[] = [
    { name: "Home", icon: <Home size={22} />, path: "/home" },
    { name: "Users", icon: <Users size={22} />, path: "/users" },
    { name: "Tasks", icon: <ClipboardList size={22} />, path: "/tasks" },
    { name: "Countries", icon: <Globe size={22} />, path: "/countries" },
    { name: "States", icon: <MapPin size={22} />, path: "/states" },
    { name: "Cities", icon: <MapPin size={22} />, path: "/cities" },
    { name: "Settings", icon: <Settings size={22} />, path: "/settings" },
  ];

  /**
   * Ab koi link adminOnly nahi hai, lekin future ke liye logic rakh diya hai.
   * Is waqt visibleLinks == links hoga (sab dikh rahe hain).
   */
  const visibleLinks = links.filter((l) => {
    if (!l.adminOnly) return true;

    if (roleDerived === "admin") return true;
    if (hasUser === true && roleDerived === null) return true;

    return false;
  });

  return (
    <aside
      className={`${
        isOpen ? "w-64" : "w-20"
      } bg-white border-r border-gray-200 flex flex-col h-screen transition-all duration-300`}
    >
      {/* 🔹 Header with Logo + Toggle Button */}
      <div className="bg-[linear-gradient(90deg,#007bff_0%,#0a54c3_100%)] flex items-center justify-between p-3 border-b border-gray-200">
        <h1
          className={`text-[#ffffff] font-bold text-2xl transition-all duration-300 ${
            !isOpen && "opacity-0 w-0 overflow-hidden"
          }`}
        >
          TaskFlow
        </h1>

        <IconButton onClick={() => setIsOpen(!isOpen)}>
          {isOpen ? (
            <LayoutDashboard size={22} className="text-[#ffffff]" />
          ) : (
            <Menu color="#ffffff" size={24} />
          )}
        </IconButton>
      </div>

      {/* 🔹 Navigation Menu */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        {visibleLinks.map((link) => (
          <NavLink
            to={link.path}
            key={link.name}
            className={({ isActive }) =>
              `flex items-center gap-4 px-4 py-3 rounded-md font-medium text-sm transition-all duration-200 ${
                isActive
                  ? "bg-[#ddf6ff] text-[#3876c4]"
                  : "text-gray-600 hover:bg-gray-100"
              }`
            }
          >
            <Tooltip title={!isOpen ? link.name : ""} placement="right" arrow>
              <div className="flex items-center gap-4 w-full">
                {link.icon}
                {isOpen && (
                  <span className="text-base font-medium whitespace-nowrap">
                    {link.name}
                  </span>
                )}
              </div>
            </Tooltip>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
};

export default Sidebar;
