// src/services/stateService.ts
import { apiFetch } from "../utils/http";

export type State = {
  id: string;
  name: string;
  countryId: string;
  createdOn?: string;
  updatedOn?: string | null;
  isDeleted?: boolean;
};

type Raw = Record<string, any>;

const mapState = (d: Raw): State => ({
  id: String(d._id ?? d.id ?? d.stateID ?? ""),
  name: String(d.name ?? d.stateName ?? ""),
  countryId: String(d.countryID ?? d.countryId ?? d.country ?? ""),
  createdOn: d.createdOn,
  updatedOn: d.updatedOn ?? null,
  isDeleted: !!d.isDeleted,
});

/* -------------------------------------------------------
   GET ALL / GET BY ID
   - GET List: POST /api/CityManagement/State/GetList (body: {})
   - GET Model: GET /api/CityManagement/State/GetModel/{id}
-------------------------------------------------------- */

export const getStates = async (id?: string): Promise<State[]> => {
  try {
    if (id) {
      // if id provided, try fetching a single model and return as array
      const raw = await apiFetch(`/api/CityManagement/State/GetModel/${encodeURIComponent(id)}`, {
        method: "GET",
      });
      const arr = raw ? [raw] : [];
      return arr.map((s: Raw) => mapState(s));
    }

    // Default: fetch list (backend uses POST GetList in your project)
    const raw = await apiFetch("/api/CityManagement/State/GetList", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const arr = Array.isArray(raw) ? raw : [raw].filter(Boolean);
    return arr.map((s: Raw) => mapState(s));
  } catch (err: any) {
    // rethrow with message
    const message = err?.message ?? "Failed to fetch states";
    throw Object.assign(new Error(message), { status: err?.status, body: err?.body });
  }
};

export const getStateById = async (id: string): Promise<State | null> => {
  try {
    const raw = await apiFetch(`/api/CityManagement/State/GetModel/${encodeURIComponent(id)}`, {
      method: "GET",
    });
    return raw ? mapState(raw) : null;
  } catch (err: any) {
    if (err?.status === 404) return null;
    throw Object.assign(new Error(err?.message ?? "Failed to fetch state"), { status: err?.status, body: err?.body });
  }
};

export const getStateByIdIncludingDeleted = getStateById;

/* -------------------------------------------------------
   CREATE
   - POST /api/CityManagement/State/Insert
   - body expected: { stateName, countryId } or { StateName, CountryID } depending on backend
   We'll send keys: { stateName, countryId } (as in your fix note)
-------------------------------------------------------- */

export const createState = async (payload: { stateName: string; countryId: string | number }) => {
  try {
    const body = {
      stateName: payload.stateName,
      countryId: String(payload.countryId),
    };

    const resp = await apiFetch("/api/CityManagement/State/Insert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    // backend might return InsertedID or InsertedId or id
    const id = resp?.InsertedID ?? resp?.InsertedId ?? resp?.insertedId ?? resp?.id ?? resp?.stateID ?? null;

    if (!id) throw new Error("Insert API did not return InsertedID");

    return String(id);
  } catch (err: any) {
    throw Object.assign(new Error(err?.message ?? "Failed to create state"), { status: err?.status, body: err?.body });
  }
};

/* -------------------------------------------------------
   UPDATE
   - PUT /api/CityManagement/State/Update
   - expected body keys: { stateID, stateName, countryId } (we'll send these)
-------------------------------------------------------- */

export const updateState = async (payload: { stateID: string; stateName: string; countryId: string | number }) => {
  try {
    const body = {
      stateID: payload.stateID,
      stateName: payload.stateName,
      countryId: String(payload.countryId),
    };

    const resp = await apiFetch("/api/CityManagement/State/Update", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    // backend may return UpdatedOn or updatedOn
    return resp?.UpdatedOn ?? resp?.updatedOn ?? null;
  } catch (err: any) {
    throw Object.assign(new Error(err?.message ?? "Failed to update state"), { status: err?.status, body: err?.body });
  }
};

/* -------------------------------------------------------
   DELETE
   - DELETE /api/CityManagement/State/Delete/{ID}
-------------------------------------------------------- */

export const deleteState = async (id: string) => {
  try {
    return await apiFetch(
      `/api/CityManagement/State/Delete/${encodeURIComponent(id)}`,
      {
        method: "DELETE",
      }
    );
  } catch (err: any) {
    // ✅ IMPORTANT: backend statusCode ko preserve karo
    throw {
      response: {
        status: err?.statusCode ?? err?.status ?? 500,
        data: err?.body ?? err?.data,
      },
      message: err?.message ?? "Failed to delete state",
    };
  }
};


/* -------------------------------------------------------
   DUPLICATE CHECK
   - POST /api/CityManagement/State/CheckDuplicateStateName
   - body: { StateName, CountryID, ExcludeID }
-------------------------------------------------------- */

export const checkDuplicateStateName = async (args: {
  StateName: string;
  CountryID: string | number;
  ExcludeID?: string | null;
}) => {
  try {
    const resp = await apiFetch("/api/CityManagement/State/CheckDuplicateStateName", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        StateName: args.StateName,
        CountryID: String(args.CountryID),
        ExcludeID: args.ExcludeID ?? null,
      }),
    });

    // resp may contain { IsDuplicate: true } or similar
    return resp?.IsDuplicate === true || resp?.isDuplicate === true;
  } catch (err: any) {
    throw Object.assign(new Error(err?.message ?? "Failed to check duplicate"), { status: err?.status, body: err?.body });
  }
};

export const isStateNameUnique = async (stateName: string, countryId: string | number, excludeId?: string | null) => {
  const isDup = await checkDuplicateStateName({
    StateName: stateName,
    CountryID: countryId,
    ExcludeID: excludeId ?? null,
  });

  return !isDup;
};

/* -------------------------------------------------------
   getAllStatesIncludingDeleted
-------------------------------------------------------- */

export const getAllStatesIncludingDeleted = async () => {
  const raw = await apiFetch("/api/CityManagement/State/GetList", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });

  const arr = Array.isArray(raw) ? raw : [raw].filter(Boolean);
  return arr.map(mapState);
};

/* -------------------------------------------------------
   getStatesByCountry
-------------------------------------------------------- */

export const getStatesByCountry = async (countryId: string | number): Promise<State[]> => {
  const all = await getStates();
  return all.filter((s) => s.countryId === String(countryId));
};
