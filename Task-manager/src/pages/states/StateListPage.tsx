// src/pages/state/StateListPage.tsx
import React, { useEffect, useState } from "react";
import {
  getStates,
  deleteState,
  State as StateItem,
} from "../../services/stateService";

import AddEditStateModal from "./AddEditStateModal";
import { getAllCountriesIncludingDeleted } from "../../services/countryService";

import {
  Button,
  IconButton,
  TextField,
  MenuItem,
  Tooltip,
  CircularProgress,
  Box,
} from "@mui/material";

import { DataGrid, GridColDef } from "@mui/x-data-grid";

import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import { toast } from "react-toastify";

import ConfirmDeleteDialog from "../../components/common/ConfirmDeleteDialog";
import NoRowsMessage from "../../components/common/NoRowsMessage";

const StateListPage: React.FC = () => {
  const [states, setStates] = useState<StateItem[]>([]);
  const [countries, setCountries] = useState<
    { id: string; name: string; isDeleted?: boolean }[]
  >([]);

  const [loading, setLoading] = useState(true);

  const [openModal, setOpenModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [countryFilter, setCountryFilter] = useState<string | "">("");

  // Delete confirm
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  /* ---------------- LOAD DATA ---------------- */
  const load = async () => {
    try {
      setLoading(true);

      const activeStates = await getStates();
      const allCountries = await getAllCountriesIncludingDeleted();

      setStates(
        (activeStates || []).map((s: any) => ({
          id: String(s.id ?? s._id ?? ""),
          name: s.name ?? s.stateName ?? "",
          countryId: String(s.countryId ?? s.countryID ?? ""),
        }))
      );

      setCountries(
        (allCountries || []).map((c: any) => ({
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
  const findCountryName = (id: string) => {
    const c = countries.find((x) => x.id === id);
    return c ? c.name : "(deleted country)";
  };

  /* ---------------- FILTER ---------------- */
  const filtered = states.filter((s) => {
    if (search && !s.name.toLowerCase().includes(search.toLowerCase()))
      return false;
    if (countryFilter && s.countryId !== countryFilter) return false;
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
      await deleteState(deleteId);
      toast.success("State deleted successfully");

      setConfirmOpen(false); // ✅ success
      setDeleteId(null);

      await load();
    } catch (err: any) {
      // ✅ Same logic as Country
      if (isUsedError(err)) {
        toast.error("This state is used. You cannot delete this state.");
      } else {
        toast.error("Failed to delete state");
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
      headerName: "State Name",
      flex: 1,
      renderCell: (params) => (
        <span style={{ fontWeight: 600, color: "#1f2937" }}>
          {params.row.name}
        </span>
      ),
    },
    {
      field: "country",
      headerName: "Country",
      flex: 1,
      renderCell: (params) => (
        <span style={{ color: "#6b7280" }}>
          {findCountryName(params.row.countryId)}
        </span>
      ),
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
          <Tooltip title="Edit State" arrow>
            <IconButton
              size="small"
              onClick={() => {
                setEditId(params.row.id);
                setOpenModal(true);
              }}
            >
              <EditIcon />
            </IconButton>
          </Tooltip>

          <Tooltip title="Delete State" arrow>
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
        <h2 className="text-3xl font-semibold">States</h2>

        <div className="flex items-center gap-3">
          <Button
            variant="contained"
            sx={{
              background: "linear-gradient(90deg,#007bff,#0a54c3)",
              "&:hover": {
                background: "linear-gradient(90deg,#007bff,#0849ab)",
              },
            }}
            onClick={() => {
              setEditId(null);
              setOpenModal(true);
            }}
          >
            + Add State
          </Button>
        </div>
      </div>

      {/* FILTERS */}
      <div className="bg-white rounded shadow p-4">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-5">
          <TextField
            size="small"
            placeholder="Search states..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

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
          hideFooter
          hideFooterPagination
          disableRowSelectionOnClick
          rowHeight={72}
          slots={{
            noRowsOverlay: () => <NoRowsMessage message="No States found" />,
          }}
          sx={{
            border: "none",
            p: 2,

            /* remove footer spacing + extra column */
            "& .MuiDataGrid-footerContainer": { display: "none" },
            "& .MuiDataGrid-filler": { display: "none" },
            "& .MuiDataGrid-scrollbarFiller": { display: "none" },

            /* default cell style */
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
      <AddEditStateModal
        open={openModal}
        onClose={() => setOpenModal(false)}
        onSaved={load}
        editId={editId ?? undefined}
      />

      <ConfirmDeleteDialog
        open={confirmOpen}
        title="Delete State?"
        message="Are you sure you want to delete this state?"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
};

export default StateListPage;
