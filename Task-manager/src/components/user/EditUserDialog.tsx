// src/components/users/EditUserDialog.tsx

import React, { useEffect, useState } from "react";
import { Dialog, DialogTitle, DialogContent } from "@mui/material";
import UserForm from "./UserForm";
import { AppUser } from "../../utils/storage";
import { toast } from "react-toastify";

// NEW: backend API
import { getUserModelApi } from "../../api/userManagementApi";

// Location helpers (including deleted)
import { getAllCountriesIncludingDeleted } from "../../services/countryService";
import { getAllStatesIncludingDeleted } from "../../services/stateService";
import { getAllCitiesIncludingDeleted } from "../../services/cityService";

// Extended type: AppUser + mongoId (real backend UserID)
type ExtendedAppUser = AppUser & {
  mongoId?: string;
};

type Props = {
  open: boolean;
  userId: string | null; // 👈 ab mongoId aayega yaha
  onClose: () => void;
  onUpdated?: () => void;
  initial?: AppUser; // optional, compatibility ke liye rehne diya
};

const EditUserDialog: React.FC<Props> = ({ open, userId, onClose, onUpdated }) => {
  const [initial, setInitial] = useState<Partial<ExtendedAppUser> | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!userId) {
        setInitial(undefined);
        return;
      }

      setLoading(true);
      try {
        // 1) Get user detail
        const data: any = await getUserModelApi(userId);

        // 2) Load all locations (including deleted)
        const [allCountriesRaw, allStatesRaw, allCitiesRaw] = await Promise.all([
          getAllCountriesIncludingDeleted(),
          getAllStatesIncludingDeleted(),
          getAllCitiesIncludingDeleted(),
        ]);

        // Coerce to any[] to avoid strict type shape errors
        const allCountries: any[] = Array.isArray(allCountriesRaw) ? (allCountriesRaw as any[]) : [];
        const allStates: any[] = Array.isArray(allStatesRaw) ? (allStatesRaw as any[]) : [];
        const allCities: any[] = Array.isArray(allCitiesRaw) ? (allCitiesRaw as any[]) : [];

        const toLower = (val?: string) => (val || "").toLowerCase().trim();

        // 3) Find corresponding location objects by name (defensive)
        const countryNameFromData = String(data?.countryName ?? data?.CountryName ?? "");
        const stateNameFromData = String(data?.stateName ?? data?.StateName ?? "");
        const cityNameFromData = String(data?.cityName ?? data?.CityName ?? "");

        const countryObj = allCountries.find(
          (c: any) =>
            toLower(c.name ?? c.Name ?? c.countryName ?? c.CountryName) === toLower(countryNameFromData)
        );

        const stateObj = allStates.find(
          (s: any) =>
            toLower(s.name ?? s.Name ?? s.stateName ?? s.StateName) === toLower(stateNameFromData)
        );

        const cityObj = allCities.find(
          (c: any) =>
            toLower(c.name ?? c.Name ?? c.cityName ?? c.CityName) === toLower(cityNameFromData)
        );

        // 4) Map backend fields into AppUser shape for the UserForm
        const mapped: ExtendedAppUser = {
          id: Date.now(), // UI local id, not the DB id
          mongoId: data?.userID ?? data?.UserID ?? data?._id ?? data?.id ?? undefined,
          firstName: data?.firstName ?? data?.FirstName ?? "",
          lastName: data?.lastName ?? data?.LastName ?? "",
          email: data?.emailID ?? data?.EmailID ?? data?.email ?? "",
          address: data?.address ?? data?.Address ?? "",
          zip: data?.zipCode ?? data?.ZipCode ?? data?.zip ?? "",
          avatarUrl: data?.avatarUrl ?? data?.AvatarUrl ?? null,
          // Use defensive access: some services return `.id`, others `._id` or `countryID`
          countryId:
            (countryObj as any)?.id ??
            (countryObj as any)?._id ??
            (countryObj as any)?.countryID ??
            (countryObj as any)?.CountryID ??
            undefined,
          stateId:
            (stateObj as any)?.id ??
            (stateObj as any)?._id ??
            (stateObj as any)?.stateID ??
            (stateObj as any)?.StateID ??
            undefined,
          cityId:
            (cityObj as any)?.id ??
            (cityObj as any)?._id ??
            (cityObj as any)?.cityID ??
            (cityObj as any)?.CityID ??
            undefined,
        };

        if (mounted) setInitial(mapped);
      } catch (err) {
        console.error("EditUserDialog -> failed to load user detail:", err);
        toast.error("Failed to load user details");
        if (mounted) setInitial(undefined);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [userId]);

  const handleSave = async (_user: AppUser) => {
    toast.success("User updated successfully!");
    onUpdated?.();
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle className="font-semibold text-xl pb-0">Edit User</DialogTitle>
      <DialogContent sx={{ p: 4, pt: 3 }}>
        <UserForm initial={initial ?? undefined} onCancel={onClose} onSave={handleSave} isEdit />
      </DialogContent>
    </Dialog>
  );
};

export default EditUserDialog;
