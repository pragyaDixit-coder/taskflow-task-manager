// src/services/cityService.ts
// Updated to use apiFetch with full backend authentication support (cookies + token)

import { apiFetch } from "../utils/http";

export type City = {
  id: string;
  name: string;
  stateId: string;
  zipCodes?: string[];
  createdOn?: string;
  updatedOn?: string | null;
  isDeleted?: boolean;
};

/** Normalize backend → City */
const mapCity = (d: any): City => ({
  id: String(d._id ?? d.id ?? d.cityID ?? ""),
  name: d.name ?? d.cityName ?? "",
  stateId: String(d.stateID ?? d.stateId ?? d.StateID ?? d.state ?? ""),
  zipCodes: Array.isArray(d.zipCodes)
    ? d.zipCodes
    : d.zipCode
    ? [String(d.zipCode)]
    : [],
  createdOn: d.createdOn,
  updatedOn: d.updatedOn ?? null,
  isDeleted: !!d.isDeleted,
});

const toStateIdString = (v?: string | number | null) =>
  v === null || v === undefined ? "" : String(v);

/* -------------------------------------------------------
   GET ACTIVE CITY LIST
   POST  /api/CityManagement/City/GetList
-------------------------------------------------------- */
export const getCities = async (): Promise<City[]> => {
  try {
    const raw = await apiFetch("/api/CityManagement/City/GetList", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const arr = Array.isArray(raw) ? raw : [raw].filter(Boolean);
    return arr.map(mapCity);
  } catch (err: any) {
    throw Object.assign(
      new Error(err?.message ?? "Failed to fetch cities"),
      { status: err?.status, body: err?.body }
    );
  }
};

/* -------------------------------------------------------
   GET SINGLE CITY BY ID
   GET /api/CityManagement/City/GetModel/:id
-------------------------------------------------------- */
export const getCityById = async (id: string): Promise<City | null> => {
  if (!id) return null;

  try {
    const raw = await apiFetch(
      `/api/CityManagement/City/GetModel/${encodeURIComponent(id)}`,
      { method: "GET" }
    );

    return raw ? mapCity(raw) : null;
  } catch (err: any) {
    if (err?.status === 404) return null;
    throw Object.assign(new Error(err?.message ?? "Failed to fetch city"), {
      status: err?.status,
      body: err?.body,
    });
  }
};

/* -------------------------------------------------------
   GET LOOKUP LIST
   GET /api/CityManagement/City/GetLookupList
-------------------------------------------------------- */
export const getCityLookupList = async (): Promise<
  { id: string; name: string; stateId?: string }[]
> => {
  try {
    const data = await apiFetch("/api/CityManagement/City/GetLookupList", {
      method: "GET",
    });

    if (!Array.isArray(data)) return [];

    return data.map((d: any) => ({
      id: String(d._id ?? d.id ?? d.cityID ?? ""),
      name: d.name ?? d.cityName ?? "",
      stateId: String(d.stateID ?? d.stateId ?? d.StateID ?? ""),
    }));
  } catch (err: any) {
    throw Object.assign(
      new Error(err?.message ?? "Failed to fetch city lookup list"),
      { status: err?.status, body: err?.body }
    );
  }
};

/* -------------------------------------------------------
   CREATE CITY
   POST /api/CityManagement/City/Insert
-------------------------------------------------------- */
export const createCity = async (payload: {
  cityName: string;
  stateId: string | number;
  zipCodes?: string[] | string;
}) => {
  try {
    const body = {
      cityName: String(payload.cityName ?? "").trim(),
      stateId: toStateIdString(payload.stateId),
      zipCodes: Array.isArray(payload.zipCodes)
        ? payload.zipCodes
        : payload.zipCodes
        ? String(payload.zipCodes)
            .split(",")
            .map((z) => z.trim())
        : [],
    };

    const resp = await apiFetch("/api/CityManagement/City/Insert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    return (
      resp?.InsertedID ??
      resp?.insertedId ??
      resp?.cityID ??
      resp?.id ??
      null
    );
  } catch (err: any) {
    throw Object.assign(new Error(err?.message ?? "Failed to create city"), {
      status: err?.status,
      body: err?.body,
    });
  }
};

/* -------------------------------------------------------
   UPDATE CITY
   PUT /api/CityManagement/City/Update
-------------------------------------------------------- */
export const updateCity = async (payload: {
  cityID: string;
  cityName?: string;
  stateId?: string | number;
  zipCodes?: string[] | string;
}) => {
  if (!payload.cityID) throw new Error("cityID is required for update");

  try {
    const body: any = {
      cityID: String(payload.cityID),
    };

    if (payload.cityName !== undefined)
      body.cityName = String(payload.cityName).trim();

    if (payload.stateId !== undefined)
      body.stateId = toStateIdString(payload.stateId);

    if (payload.zipCodes !== undefined)
      body.zipCodes = Array.isArray(payload.zipCodes)
        ? payload.zipCodes
        : String(payload.zipCodes)
            .split(",")
            .map((z) => z.trim());

    const resp = await apiFetch("/api/CityManagement/City/Update", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    return resp?.UpdatedOn ?? resp?.updatedOn ?? null;
  } catch (err: any) {
    throw Object.assign(new Error(err?.message ?? "Failed to update city"), {
      status: err?.status,
      body: err?.body,
    });
  }
};

/* -------------------------------------------------------
   DELETE CITY
   DELETE /api/CityManagement/City/Delete/:id
-------------------------------------------------------- */
export const deleteCity = async (id: string) => {
  if (!id) throw new Error("id required");

  try {
    return await apiFetch(
      `/api/CityManagement/City/Delete/${encodeURIComponent(id)}`,
      { method: "DELETE" }
    );
  } catch (err: any) {
    // ✅ IMPORTANT: backend statusCode ko preserve karo
    throw {
      response: {
        status: err?.statusCode ?? err?.status ?? 500,
        data: err?.body ?? err?.data,
      },
      message: err?.message ?? "Failed to delete city",
    };
  }
};

/* -------------------------------------------------------
   CHECK DUPLICATE CITY NAME
   POST /api/CityManagement/City/CheckDuplicateCityName
-------------------------------------------------------- */
export const checkDuplicateCityName = async (args: {
  CityName: string;
  StateID: string | number;
  ExcludeID?: string | null;
}) => {
  try {
    const body = {
      CityName: String(args.CityName).trim(),
      StateID: toStateIdString(args.StateID),
      ...(args.ExcludeID ? { ExcludeID: String(args.ExcludeID) } : {}),
    };

    const resp = await apiFetch(
      "/api/CityManagement/City/CheckDuplicateCityName",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    return resp?.IsDuplicate === true;
  } catch (err: any) {
    throw Object.assign(
      new Error(err?.message ?? "Failed to check duplicate"),
      { status: err?.status, body: err?.body }
    );
  }
};

/* -------------------------------------------------------
   GET ALL CITIES INCLUDING DELETED
-------------------------------------------------------- */
export const getAllCitiesIncludingDeleted = async (): Promise<City[]> => {
  const raw = await apiFetch("/api/CityManagement/City/GetList", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });

  const arr = Array.isArray(raw) ? raw : [raw].filter(Boolean);
  return arr.map(mapCity);
};

/* -------------------------------------------------------
   GET CITIES BY STATE
-------------------------------------------------------- */
export const getCitiesByState = async (
  stateId: string | number
): Promise<City[]> => {
  if (!stateId) return [];
  const all = await getCities();
  const sid = toStateIdString(stateId);
  return all.filter((c) => String(c.stateId) === sid);
};
