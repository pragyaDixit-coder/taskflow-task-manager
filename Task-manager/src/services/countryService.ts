// src/services/countryService.ts
// Hinglish: Ab ye service backend APIs use karegi via centralized apiFetch.
// IDs use string (MongoDB _id / CountryID) to avoid TS mismatches.

import { apiFetch } from "../utils/http";

export type Country = {
  id: string; // backend MongoDB _id (CountryID) as string
  name: string;
  isDeleted?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

let countryCache: Country[] = [];

const now = () => new Date().toISOString();

/* ----------------------------------------------
   MAP BACKEND → FRONTEND Country
   Expected backend shape: { countryID, countryName, createdOn, updatedOn, ... }
---------------------------------------------- */
const mapBackendCountryList = (data: any[] = []): Country[] => {
  return (data || []).map((c: any) => ({
    id: String(c.countryID ?? c._id ?? c.id ?? ""),
    name: c.countryName ?? c.name ?? "",
    createdAt: c.createdOn ?? undefined,
    updatedAt: c.updatedOn ?? undefined,
    isDeleted: !!c.isDeleted,
  }));
};

/* ----------------------------------------------
   GET ACTIVE ONLY (backend)
   Route: POST /api/CityManagement/Country/GetList
---------------------------------------------- */
export const getCountries = async (): Promise<Country[]> => {
  // apiFetch will use API_BASE_URL internally; pass full path starting with /api/...
  const raw = await apiFetch("/api/CityManagement/Country/GetList", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });

  const mapped = mapBackendCountryList(Array.isArray(raw) ? raw : []);
  countryCache = mapped;
  return mapped;
};

/* ----------------------------------------------
   GET ALL INCLUDING DELETED (best-effort via cache)
---------------------------------------------- */
export const getAllCountriesIncludingDeleted = async (): Promise<Country[]> => {
  if (!countryCache.length) {
    try {
      await getCountries();
    } catch (err) {
      // ignore fetch error; return empty array as fallback
      console.warn("getAllCountriesIncludingDeleted: failed to refresh cache", err);
    }
  }
  return countryCache.slice();
};

/* ----------------------------------------------
   Get ONE by backend id (string)
   Try cache first, then GetModel endpoint if available.
   Route: GET /api/CityManagement/Country/GetModel/{id}  (best-effort)
---------------------------------------------- */
export const getCountryById = async (id: string): Promise<Country | null> => {
  if (!id) return null;

  const fromCache = countryCache.find((c) => String(c.id) === String(id));
  if (fromCache) return fromCache;

  try {
    const raw = await apiFetch(`/api/CityManagement/Country/GetModel/${encodeURIComponent(id)}`, {
      method: "GET",
      parseJson: true,
    });

    if (!raw) return null;
    const mapped = mapBackendCountryList([raw])[0] ?? null;
    return mapped;
  } catch (err) {
    // If server returns 404/401 etc, allow caller to handle it; log for debug
    console.warn("getCountryById failed:", err);
    return null;
  }
};

/* ----------------------------------------------
   CREATE
   Route: POST /api/CityManagement/Country/Insert
   Body: { CountryName }
   Response: { countryID }
---------------------------------------------- */
export const createCountry = async (data: { name: string }): Promise<Country> => {
  const nameTrimmed = (data.name || "").trim();
  if (!nameTrimmed) throw new Error("Country name is required");

  const body = await apiFetch("/api/CityManagement/Country/Insert", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ CountryName: nameTrimmed }),
  });

  const createdId = String(body?.countryID ?? body?.countryId ?? body?.id ?? "");

  try {
    // Refresh cache (best practice)
    await getCountries();
  } catch (err) {
    console.warn("createCountry: failed to refresh list after create", err);
  }

  const fromCache = countryCache.find((c) => c.id === createdId);
  if (fromCache) return fromCache;

  const fallback: Country = {
    id: createdId || `${Date.now()}`,
    name: nameTrimmed,
    createdAt: now(),
    updatedAt: now(),
    isDeleted: false,
  };
  countryCache = [...countryCache, fallback];
  return fallback;
};

/* ----------------------------------------------
   UPDATE
   Route: PUT /api/CityManagement/Country/Update
   Body: { CountryID, CountryName }
---------------------------------------------- */
export const updateCountry = async (country: { id: string; name: string }): Promise<Country> => {
  const nameTrimmed = (country.name || "").trim();
  if (!country.id) throw new Error("Country id is required for update");
  if (!nameTrimmed) throw new Error("Country name is required");

  await apiFetch("/api/CityManagement/Country/Update", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      CountryID: country.id,
      CountryName: nameTrimmed,
    }),
  });

  // refresh cache and return updated object
  await getCountries();
  const updated = countryCache.find((c) => String(c.id) === String(country.id));
  if (updated) return updated;

  return {
    id: country.id,
    name: nameTrimmed,
    updatedAt: now(),
    isDeleted: false,
  };
};

/* ----------------------------------------------
   SOFT DELETE (backend)
   Route: DELETE /api/CityManagement/Country/Delete/{ID}
---------------------------------------------- */
export const deleteCountry = async (id: string): Promise<void> => {
  if (!id) throw new Error("Country id required for delete");

  await apiFetch(`/api/CityManagement/Country/Delete/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });

  countryCache = countryCache.filter((c) => String(c.id) !== String(id));
};

/* ----------------------------------------------
   UNIQUE CHECK (client-side, best-effort)
---------------------------------------------- */
export const isCountryNameUnique = (name: string, excludeId?: string): boolean => {
  const n = (name || "").trim().toLowerCase();
  if (!n) return true;
  if (!countryCache.length) return true; // best-effort; prefer server check for absolute truth
  return !countryCache.some(
    (c) => c.name.trim().toLowerCase() === n && (!excludeId || String(c.id) !== String(excludeId))
  );
};

/* default export convenience */
export default {
  getCountries,
  getAllCountriesIncludingDeleted,
  getCountryById,
  createCountry,
  updateCountry,
  deleteCountry,
  isCountryNameUnique,
};
