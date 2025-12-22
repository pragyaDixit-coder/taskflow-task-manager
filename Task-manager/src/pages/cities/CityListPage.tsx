// src/pages/cities/CityListPage.tsx
import React, { useEffect, useState } from "react";
import {
  getCities,
  deleteCity,
  getAllCitiesIncludingDeleted,
} from "../../services/cityService";

import {
  getStates,
  getAllStatesIncludingDeleted,
} from "../../services/stateService";

import {
  getCountries,
  getAllCountriesIncludingDeleted,
} from "../../services/countryService";

import AddEditCityModal from "./AddEditCityModal";

import {
  Button,
  TextField,
  MenuItem,
  IconButton,
  Tooltip,
  Box,
} from "@mui/material";

import { DataGrid, GridColDef } from "@mui/x-data-grid";

import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";

import { toast } from "react-toastify";
import ConfirmDeleteDialog from "../../components/common/ConfirmDeleteDialog";
import NoRowsMessage from "../../components/common/NoRowsMessage";

/* ---------------- TYPES ---------------- */

type City = {
  id: string;
  name: string;
  stateId: string;
  zipCodes?: string[];
  isDeleted?: boolean;
};

type StateItem = {
  id: string;
  name: string;
  countryId?: string;
  isDeleted?: boolean;
};

type Country = {
  id: string;
  name: string;
  isDeleted?: boolean;
};

const CityListPage: React.FC = () => {
  const [cities, setCities] = useState<City[]>([]);
  const [allCities, setAllCities] = useState<City[]>([]);

  const [states, setStates] = useState<StateItem[]>([]);
  const [allStates, setAllStates] = useState<StateItem[]>([]);

  const [countries, setCountries] = useState<Country[]>([]);
  const [allCountries, setAllCountries] = useState<Country[]>([]);

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState<string | "">("");
  const [countryFilter, setCountryFilter] = useState<string | "">("");

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  /* ---------------- LOAD DATA ---------------- */

  const load = async () => {
    try {
      setLoading(true);

      const [activeCities, activeStates, activeCountries] = await Promise.all([
        getCities(),
        getStates(),
        getCountries(),
      ]);

      setCities(
        (activeCities || []).map((c: any) => ({
          id: String(c.id ?? c._id ?? ""),
          name: c.name ?? c.cityName ?? "",
          stateId: String(c.stateId ?? c.stateID ?? ""),
          zipCodes: c.zipCodes ?? [],
          isDeleted: !!c.isDeleted,
        }))
      );

      setStates(
        (activeStates || []).map((s: any) => ({
          id: String(s.id ?? s._id ?? ""),
          name: s.name ?? s.stateName ?? "",
          countryId: String(s.countryId ?? s.countryID ?? ""),
          isDeleted: !!s.isDeleted,
        }))
      );

      setCountries(
        (activeCountries || []).map((c: any) => ({
          id: String(c.id ?? c._id ?? ""),
          name: c.name ?? c.countryName ?? "",
          isDeleted: !!c.isDeleted,
        }))
      );

      const [allCitiesArr, allStatesArr, allCountriesArr] = await Promise.all([
        getAllCitiesIncludingDeleted(),
        getAllStatesIncludingDeleted(),
        getAllCountriesIncludingDeleted(),
      ]);

      setAllCities(
        (allCitiesArr || []).map((c: any) => ({
          id: String(c.id ?? c._id ?? ""),
          name: c.name ?? c.cityName ?? "",
          stateId: String(c.stateId ?? c.stateID ?? ""),
          zipCodes: c.zipCodes ?? [],
          isDeleted: !!c.isDeleted,
        }))
      );

      setAllStates(
        (allStatesArr || []).map((s: any) => ({
          id: String(s.id ?? s._id ?? ""),
          name: s.name ?? s.stateName ?? "",
          countryId: String(s.countryId ?? s.countryID ?? ""),
          isDeleted: !!s.isDeleted,
        }))
      );

      setAllCountries(
        (allCountriesArr || []).map((c: any) => ({
          id: String(c.id ?? c._id ?? ""),
          name: c.name ?? c.countryName ?? "",
          isDeleted: !!c.isDeleted,
        }))
      );
    } catch {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  /* ---------------- HELPERS ---------------- */

  const findStateName = (stateId?: string) => {
    const st = allStates.find((s) => String(s.id) === String(stateId));
    return st ? st.name : "(deleted state)";
  };

  const findCountryNameByState = (stateId?: string) => {
    const st = allStates.find((s) => String(s.id) === String(stateId));
    if (!st) return "(deleted country)";
    const c = allCountries.find((c) => String(c.id) === String(st.countryId));
    return c ? c.name : "(deleted country)";
  };

  /* ---------------- FILTER ---------------- */

  const filtered = cities.filter((c) => {
    if (search && !c.name.toLowerCase().includes(search.toLowerCase()))
      return false;
    if (stateFilter && String(c.stateId) !== String(stateFilter)) return false;

    if (countryFilter) {
      const st = allStates.find((s) => String(s.id) === String(c.stateId));
      if (!st || String(st.countryId) !== String(countryFilter)) return false;
    }
    return true;
  });

  /* ---------------- DELETE ---------------- */

  const handleDeleteClick = (id: string) => {
    setDeleteId(id);
    setConfirmOpen(true);
  };

  const isUsedError = (err: any) => {
    return (
      err?.response?.status === 409 ||
      err?.response?.data?.message?.toLowerCase().includes("used")
    );
  };

  const handleConfirmDelete = async () => {
    if (!deleteId) return;

    setDeleteLoading(true);
    try {
      await deleteCity(deleteId);
      toast.success("City deleted successfully");

      setConfirmOpen(false); // ✅ success
      setDeleteId(null);

      await load();
    } catch (err: any) {
      // ✅ SAME LOGIC as Country / State
      if (isUsedError(err)) {
        toast.error("This city is used. You cannot delete this city.");
      } else {
        toast.error("Failed to delete city");
      }

      // ✅ MAIN FIX: error par bhi dialog close
      setConfirmOpen(false);
      setDeleteId(null);
    } finally {
      setDeleteLoading(false);
    }
  };

  /* ---------------- DATAGRID COLUMNS ---------------- */

  const columns: GridColDef[] = [
    {
      field: "name",
      headerName: "City Name",
      flex: 1,
      renderCell: (params) => (
        <span style={{ fontWeight: 600, color: "#1f2937" }}>
          {params.row.name}
        </span>
      ),
    },
    {
      field: "state",
      headerName: "State",
      flex: 1,
      renderCell: (params) => findStateName(params.row.stateId),
    },
    {
      field: "country",
      headerName: "Country",
      flex: 1,
      renderCell: (params) => findCountryNameByState(params.row.stateId),
    },
    {
      field: "zipCodes",
      headerName: "Zip Code(s)",
      flex: 1,
      align: "center",
      headerAlign: "center",
      renderCell: (params) => (params.row.zipCodes || []).join(", "),
    },
    {
      field: "actions",
      headerName: "Actions",
      width: 140,
      align: "right",
      headerAlign: "right",
      sortable: false,
      renderCell: (params) => (
        <>
          <Tooltip title="Edit city details" arrow>
            <IconButton
              size="small"
              onClick={() => {
                setEditId(params.row.id);
                setOpen(true);
              }}
            >
              <EditIcon />
            </IconButton>
          </Tooltip>

          <Tooltip title="Delete city" arrow>
            <IconButton
              size="small"
              onClick={() => handleDeleteClick(params.row.id)}
              disabled={deleteLoading}
            >
              <DeleteIcon color="error" />
            </IconButton>
          </Tooltip>
        </>
      ),
    },
  ];

  return (
    <div className="p-4 overflow-hidden">
      {/* HEADER */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-3xl font-semibold">Cities</h2>

        <Button
          variant="contained"
          sx={{
            background: "linear-gradient(90deg, #007bff 0%, #0a54c3 100%)",
            "&:hover": { background: "linear-gradient(90deg,#007bff,#0849ab)" },
          }}
          onClick={() => {
            setEditId(null);
            setOpen(true);
          }}
        >
          + Add City
        </Button>
      </div>

      {/* FILTERS */}
      <div className="bg-white p-4 rounded shadow">
        <div className="items-center grid grid-cols-1 sm:grid-cols-6 gap-5">
          <TextField
            size="small"
            label="Search cities..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <TextField
            select
            size="small"
            label="All States"
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
             SelectProps={{
              MenuProps: {
                PaperProps: {
                  sx: {
                    maxHeight: 48 * 4,
                    overflowY: "auto",
                  },
                },
              },
            }}
          >
            <MenuItem value="">All States</MenuItem>
            {states.map((s) => (
              <MenuItem key={s.id} value={s.id}>
                {s.name}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            size="small"
            label="All Countries"
            value={countryFilter}
            onChange={(e) => setCountryFilter(e.target.value)}
            SelectProps={{
              MenuProps: {
                PaperProps: {
                  sx: {
                    maxHeight: 48 * 4,
                    overflowY: "auto",
                  },
                },
              },
            }}
          >
            <MenuItem value="">All Countries</MenuItem>

            {countries.map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {c.name}
              </MenuItem>
            ))}
          </TextField>
        </div>
      </div>

      {/* DATAGRID */}
      <Box
        sx={{
          minHeight: "200px", // 👈 kam data par chhota rahe
          maxHeight: "60vh", // 👈 zyada data par limit
          overflow: "auto",
          backgroundColor: "#fff",
          borderRadius: 2,
          boxShadow: 1,
          mt: 4,
        }}
      >
        <DataGrid
          rows={filtered}
          columns={columns}
          loading={loading}
          getRowId={(row) => row.id}
          disableRowSelectionOnClick
          hideFooter
          hideFooterPagination
          rowHeight={72}
          slots={{
            noRowsOverlay: () => <NoRowsMessage message="No Cities found" />,
          }}
          sx={{
            border: "none",
            p: 2,

            /* ✅ remove footer spacing */
            "& .MuiDataGrid-footerContainer": {
              display: "none",
            },

            /* default cell style (gray-500) */
            "& .MuiDataGrid-cell": {
              fontSize: "0.945rem",
              fontWeight: 400,
              color: "#6b7280",
            },

            "& .MuiDataGrid-columnHeaders": {
              backgroundColor: "#f9fafb",
              fontSize: "1rem",
              fontWeight: 500,
              color: "#6b7280",
            },
            "& .MuiDataGrid-columnHeaderTitle": {
              fontWeight: 600,
            },
          }}
        />
      </Box>

      {/* MODALS */}
      <AddEditCityModal
        open={open}
        onClose={() => setOpen(false)}
        onSaved={load}
        editId={editId ?? undefined}
      />

      <ConfirmDeleteDialog
        open={confirmOpen}
        title="Delete City?"
        message="Are you sure you want to delete this city?"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
};

export default CityListPage;
