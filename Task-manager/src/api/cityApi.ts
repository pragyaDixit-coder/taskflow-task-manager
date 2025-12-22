// src/api/cityApi.ts
// Low-level API calls for City management (wrapper around fetch).
// Follows same pattern as src/api/userApi.ts

import { getToken } from "../utils/storage";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const getAuthHeaders = () => {
  const token = getToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

// GET /GetList (optional Id query param)
// returns array or single object depending on query param
export const getCitiesApi = async (id?: string) => {
  const q = id ? `?Id=${encodeURIComponent(id)}` : "";
  const res = await fetch(`${API_BASE_URL}/CityManagement/City/GetList${q}`, {
    method: "GET",
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || res.statusText || "Failed to fetch cities");
  }
  return res.json();
};

// GET /GetModel/:id
export const getCityModelApi = async (id: string) => {
  const res = await fetch(
    `${API_BASE_URL}/CityManagement/City/GetModel/${encodeURIComponent(id)}`,
    {
      method: "GET",
      headers: getAuthHeaders(),
    }
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || res.statusText || "Failed to fetch city");
  }
  return res.json();
};

// GET /GetLookupList
export const getCityLookupListApi = async () => {
  const res = await fetch(`${API_BASE_URL}/CityManagement/City/GetLookupList`, {
    method: "GET",
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || res.statusText || "Failed to fetch city lookup");
  }
  return res.json();
};

// POST /Insert -> { cityName, stateId, zipCodes } -> returns { InsertedID }
export const insertCityApi = async (payload: {
  cityName: string;
  stateId: string | number;
  zipCodes?: string[] | string;
}) => {
  const body = {
    cityName: payload.cityName,
    stateId: payload.stateId,
    zipCodes: Array.isArray(payload.zipCodes)
      ? payload.zipCodes
      : payload.zipCodes
      ? [payload.zipCodes]
      : [],
  };
  const res = await fetch(`${API_BASE_URL}/CityManagement/City/Insert`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err.message || res.statusText || "Failed to insert city";
    const e: any = new Error(msg);
    e.status = res.status;
    e.body = err;
    throw e;
  }
  return res.json();
};

// PUT /Update -> { cityID, cityName, stateId, zipCodes } -> returns { UpdatedOn }
export const updateCityApi = async (payload: {
  cityID: string;
  cityName?: string;
  stateId?: string | number;
  zipCodes?: string[] | string;
}) => {
  const body: any = {
    cityID: payload.cityID,
  };
  if (payload.cityName !== undefined) body.cityName = payload.cityName;
  if (payload.stateId !== undefined) body.stateId = payload.stateId;
  if (payload.zipCodes !== undefined)
    body.zipCodes = Array.isArray(payload.zipCodes) ? payload.zipCodes : [payload.zipCodes];

  const res = await fetch(`${API_BASE_URL}/CityManagement/City/Update`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err.message || res.statusText || "Failed to update city";
    const e: any = new Error(msg);
    e.status = res.status;
    e.body = err;
    throw e;
  }
  return res.json();
};

// DELETE /Delete/:id
export const deleteCityApi = async (id: string) => {
  const res = await fetch(
    `${API_BASE_URL}/CityManagement/City/Delete/${encodeURIComponent(id)}`,
    {
      method: "DELETE",
      headers: getAuthHeaders(),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err.message || res.statusText || "Failed to delete city";
    const e: any = new Error(msg);
    e.status = res.status;
    e.body = err;
    throw e;
  }
  return res.json();
};

// POST /CheckDuplicateCityName -> { CityName, StateID, ExcludeID } -> returns { IsDuplicate: boolean }
export const checkDuplicateCityNameApi = async (args: {
  CityName: string;
  StateID: string | number;
  ExcludeID?: string | null;
}) => {
  const res = await fetch(
    `${API_BASE_URL}/CityManagement/City/CheckDuplicateCityName`,
    {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(args),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err.message || res.statusText || "Failed to check duplicate city name";
    const e: any = new Error(msg);
    e.status = res.status;
    e.body = err;
    throw e;
  }
  return res.json();
};
