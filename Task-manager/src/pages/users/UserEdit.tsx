// src/pages/users/UserEdit.tsx
import React, { useEffect, useState } from "react";
import EditUserDialog from "../../components/user/EditUserDialog";
import { useNavigate, useParams } from "react-router-dom";

/**
 * UserEdit page wrapper
 * - Reads :id from route (string)
 * - Passes the string userId (or null) to EditUserDialog which expects string|null
 * - If no id present, redirects back to /users
 */
const UserEdit: React.FC = () => {
  // useParams generic ensures id is typed as string | undefined
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const [open, setOpen] = useState(true);

  // keep userId as string | null (do NOT convert to number)
  const userId: string | null = id ?? null;

  useEffect(() => {
    // if route has no id, go back to users list
    if (!id) {
      navigate("/users");
    }
  }, [id, navigate]);

  return (
    <EditUserDialog
      open={open}
      userId={userId}
      onClose={() => {
        setOpen(false);
        navigate("/users");
      }}
      onUpdated={() => navigate("/users")}
    />
  );
};

export default UserEdit;
