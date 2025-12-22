// src/pages/users/UserCreate.tsx
import React, { useState } from "react";
import AddUserDialog from "../../components/user/AddUserDialog";
import { useNavigate } from "react-router-dom";

const UserCreate: React.FC = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(true);
  return (
    <AddUserDialog
      open={open}
      onClose={() => { setOpen(false); navigate("/users"); }}
      onSaved={() => navigate("/users")}
    />
  );
};

export default UserCreate;
