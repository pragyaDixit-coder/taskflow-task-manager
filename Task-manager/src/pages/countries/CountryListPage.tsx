// src/pages/country/CountryListPage.tsx
import React, { useEffect, useState } from "react";
import {
  getCountries,
  deleteCountry,
} from "../../services/countryService";

import AddEditCountryModal from "./AddEditCountryModal";

import {
  Button,
  IconButton,
  TextField,
  InputAdornment,
  Tooltip,
  Typography,
  Box,
} from "@mui/material";

import { DataGrid, GridColDef } from "@mui/x-data-grid";

import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import SearchIcon from "@mui/icons-material/Search";
import DeleteIcon from "@mui/icons-material/Delete";

import { toast } from "react-toastify";
import ConfirmDeleteDialog from "../../components/common/ConfirmDeleteDialog";
import NoRowsMessage from "../../components/common/NoRowsMessage";

type LocalCountry = {
  id: string;
  name: string;
  isDeleted?: boolean;
};

const CountryListPage: React.FC = () => {
  const [countries, setCountries] = useState<LocalCountry[]>([]);
  const [loading, setLoading] = useState(true);

  const [openModal, setOpenModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const [search, setSearch] = useState("");

  // Delete confirmation
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  /* -----------------------------------
        LOAD COUNTRIES
  ----------------------------------- */
  const load = async () => {
    setLoading(true);
    try {
      const data = await getCountries();
      const mapped: LocalCountry[] =
        (data || []).map((c: any) => ({
          id: String(c.id ?? c._id ?? c.countryID ?? ""),
          name: c.name ?? c.countryName ?? "",
          isDeleted: !!c.isDeleted,
        })) || [];
      setCountries(mapped);
    } catch (err) {
      toast.error("Failed to load countries");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  /* -----------------------------------
        DELETE LOGIC
  ----------------------------------- */
  const handleDeleteClick = (id: string) => {
    setDeleteId(id);
    setConfirmOpen(true);
  };

  const isUsedError = (err: any) => {
    const msg =
      err?.response?.data?.message ??
      err?.message ??
      "";
    return msg.toLowerCase().includes("use");
  };

 const handleConfirmDelete = async () => {
  if (!deleteId) return;

  setDeleteLoading(true);
  try {
    await deleteCountry(deleteId);
    toast.success("Country deleted successfully!");

    setConfirmOpen(false);   // ✅ success → close dialog
    setDeleteId(null);

    await load();
  } catch (err: any) {
    if (isUsedError(err)) {
      toast.error("This country is used. You cannot delete this country.");
    } else {
      toast.error("Failed to delete country");
    }

    // ✅ MAIN FIX: error par bhi dialog close
    setConfirmOpen(false);
    setDeleteId(null);

  } finally {
    setDeleteLoading(false);
  }
};


  /* -----------------------------------
        FILTER
  ----------------------------------- */
  const filtered = countries.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  /* -----------------------------------
        DATAGRID COLUMNS
  ----------------------------------- */
  const columns: GridColDef[] = [
    {
      field: "name",
      headerName: "Country Name",
      flex: 1,
      sortable: false,
    },
    {
      field: "actions",
      headerName: "Actions",
      sortable: false,
      width: 160,
      align: "right",
      headerAlign: "right",
      renderCell: (params) => (
        <>
          <Tooltip title="Edit Country" arrow>
            <IconButton
              size="small"
              onClick={() => {
                setEditId(params.row.id);
                setOpenModal(true);
              }}
            >
              <EditOutlinedIcon />
            </IconButton>
          </Tooltip>

          <Tooltip title="Delete Country" arrow>
            <span>
              <IconButton
                size="small"
                disabled={deleteLoading}
                onClick={() => handleDeleteClick(params.row.id)}
              >
                <DeleteIcon color="error" />
              </IconButton>
            </span>
          </Tooltip>
        </>
      ),
    },
  ];

  /* -----------------------------------
        UI
  ----------------------------------- */
  return (
    <div className="p-4 space-y-4 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-semibold">Countries</h2>

        <Button
          variant="contained"
          sx={{
            background: "linear-gradient(90deg, #007bff, #0a54c3)",
            "&:hover": {
              background: "linear-gradient(90deg, #007bff, #0849ab)",
            },
          }}
          onClick={() => {
            setEditId(null);
            setOpenModal(true);
          }}
        >
          + Add Country
        </Button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg shadow p-4">
        <TextField
          size="small"
          placeholder="Search countries..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="medium" />
              </InputAdornment>
            ),
          }}
          sx={{ minWidth: 450 }}
        />
      </div>

      {/* DataGrid (NO PAGINATION FOOTER) */}
      <Box
        sx={{
          minHeight: "200px",     // 👈 kam data par chhota rahe
          maxHeight: "60vh",      // 👈 zyada data par limit
          overflow: "auto",     // 🔑 only grid scroll
          backgroundColor: "#fff",
          borderRadius: 2,
          boxShadow: 1,
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
                    noRowsOverlay: () => <NoRowsMessage message="No Coutries found" />,
                  }}
          sx={{
            border: "none",
            p: 2,

            /* 🔑 BODY CELL FONT */
            "& .MuiDataGrid-cell": {
              fontSize: "0.945rem",        // text-sm (Tailwind equivalent)
              fontWeight: 600,
              color: "#1f2937",            // gray-800
            },

            /* 🔑 HEADER FONT */
            "& .MuiDataGrid-columnHeaders": {
              backgroundColor: "#f9fafb",
             fontSize: "1rem",           // text-lg
              fontWeight: 600,
              color: "#6b7280",            // gray-500
            },

            "& .MuiDataGrid-columnHeaderTitle": {
              fontWeight: 600,
            },

            /* 🔑 REMOVE FOCUS OUTLINE (table jaisa feel) */
            "& .MuiDataGrid-cell:focus": {
              outline: "none",
            },
            "& .MuiDataGrid-columnHeader:focus": {
              outline: "none",
            },
          }}
        />

      </Box>

      {/* Modals */}
      <AddEditCountryModal
        open={openModal}
        onClose={() => setOpenModal(false)}
        onSaved={load}
        editId={editId ?? undefined}
      />

      <ConfirmDeleteDialog
        open={confirmOpen}
        title="Delete Country?"
        message="Are you sure you want to delete this country?"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
};

export default CountryListPage;
