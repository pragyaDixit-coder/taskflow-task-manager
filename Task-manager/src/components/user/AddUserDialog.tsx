// src/pages/users/AddUserDialog.tsx
import React from "react";
import { Dialog, DialogContent } from "@mui/material";
import UserForm from "../../components/user/UserForm";
import { addUser, updateUser } from "../../services/userService";
import { AppUser } from "../../utils/storage";
import { toast } from "react-toastify";

type Props = {
  open: boolean;
  onClose: () => void;
  // ✅ Allow both sync or async handlers
  onSaved: () => void | Promise<void>;
  initial?: AppUser | null;
};

const AddUserDialog: React.FC<Props> = ({ open, onClose, onSaved, initial }) => {
  // ✅ Make this async so it always returns a Promise<void>
  const handleSave = async (user: AppUser) => {
    try {
      if (initial) {
        // update path: ensure id is a string and build partial payload expected by updateUser
        const payload: Partial<AppUser> & { id: string; updatePassword?: boolean; password?: string } = {
          id: String(user.id ?? ""), // <-- force string (fixes TS error)
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          address: user.address,
          countryId: user.countryId,
          stateId: user.stateId,
          cityId: user.cityId,
          zip: user.zip,
          avatarUrl: user.avatarUrl ?? null,
          // If your UI allows changing password, set updatePassword and password accordingly.
          // updatePassword: true,
          // password: user.password,
        };

        await updateUser(payload);
        toast.success("User updated successfully!");
      } else {
        // add path: build the payload shape addUser expects (no id required)
        const payload: Partial<AppUser> & { password?: string } = {
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          address: user.address,
          countryId: user.countryId,
          stateId: user.stateId,
          cityId: user.cityId,
          zip: user.zip,
          avatarUrl: user.avatarUrl ?? null,
          // if UserForm collects a password field, include it here:
          // password: (user as any).password,
        };

        await addUser(payload);
        toast.success("User added successfully!");
      }

      // ✅ Remove temporary avatar preview (cleanup)
      sessionStorage.removeItem("tempAvatar");

      // call onSaved (may be async)
      await Promise.resolve(onSaved());
      onClose();
    } catch (err) {
      console.error("AddUserDialog handleSave error:", err);
      toast.error("Failed to save user.");
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogContent>
        <UserForm
          initial={initial ?? undefined}
          onCancel={onClose}
          onSave={handleSave}
          isEdit={!!initial}
        />
      </DialogContent>
    </Dialog>
  );
};

export default AddUserDialog;
