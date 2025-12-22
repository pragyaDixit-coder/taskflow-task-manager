// src/services/stateApi.ts
// Hinglish: State related low-level API calls. These functions call your apiClient wrapper
// and return the parsed response body (res.data if using axios-like client).

import api from "./apiClient";

type AnyObj = Record<string, any>;

/**
 * helper to extract response body in a flexible way
 */
const extract = (res: any) => {
  // axios -> res.data, fetch wrapper might return body directly
  return res && typeof res === "object" && "data" in res ? res.data : res;
};

const handleError = (err: any) => {
  // normalize error with status and body if available
  const e: any = new Error(err?.message ?? "Request failed");
  e.status = err?.status ?? err?.response?.status ?? null;
  e.body = err?.body ?? err?.response?.data ?? null;
  throw e;
};

/* -------------------------
   GET GetList (optional Id query)
   returns array or single object depending on backend behaviour
   ------------------------- */
export const getStatesApi = async (id?: string) => {
  try {
    const q = id ? `?Id=${encodeURIComponent(id)}` : "";
    const res = await api.get(`/CityManagement/State/GetList${q}`);
    return extract(res);
  } catch (err) {
    handleError(err);
  }
};

/* -------------------------
   GET GetModel/:id
   ------------------------- */
export const getStateModelApi = async (id: string) => {
  try {
    const res = await api.get(`/CityManagement/State/GetModel/${encodeURIComponent(id)}`);
    return extract(res);
  } catch (err) {
    handleError(err);
  }
};

/* -------------------------
   GET GetLookupList
   ------------------------- */
export const getStateLookupListApi = async () => {
  try {
    const res = await api.get(`/CityManagement/State/GetLookupList`);
    return extract(res);
  } catch (err) {
    handleError(err);
  }
};

/* -------------------------
   POST Insert
   body expected: { stateName: string, countryId: string }
   returns: { InsertedID }
   ------------------------- */
export const insertStateApi = async (payload: { stateName: string; countryId: string }) => {
  try {
    const body = {
      stateName: payload.stateName,
      countryId: payload.countryId,
    };
    const res = await api.post(`/CityManagement/State/Insert`, body);
    return extract(res);
  } catch (err) {
    handleError(err);
  }
};

/* -------------------------
   PUT Update
   body expected: { stateID: string, stateName: string, countryId: string }
   returns: { UpdatedOn }
   ------------------------- */
export const updateStateApi = async (payload: { stateID: string; stateName: string; countryId: string }) => {
  try {
    const body = {
      stateID: payload.stateID,
      stateName: payload.stateName,
      countryId: payload.countryId,
    };
    const res = await api.put(`/CityManagement/State/Update`, body);
    return extract(res);
  } catch (err) {
    handleError(err);
  }
};

/* -------------------------
   DELETE Delete/:id
   ------------------------- */
export const deleteStateApi = async (id: string) => {
  try {
    const res = await api.delete(`/CityManagement/State/Delete/${encodeURIComponent(id)}`);
    return extract(res);
  } catch (err) {
    handleError(err);
  }
};

/* -------------------------
   POST CheckDuplicateStateName
   Body shape accepted by backend controller: { StateName, CountryID, ExcludeID }
   We accept the args object and forward it as-is so callers can pass either casing.
   returns: { IsDuplicate: boolean }
   ------------------------- */
export const checkDuplicateStateNameApi = async (args: {
  StateName: string;
  CountryID: string;
  ExcludeID?: string | null;
}) => {
  try {
    const res = await api.post(`/CityManagement/State/CheckDuplicateStateName`, args);
    return extract(res);
  } catch (err) {
    handleError(err);
  }
};
