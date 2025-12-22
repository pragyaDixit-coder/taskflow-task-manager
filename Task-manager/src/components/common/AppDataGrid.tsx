import * as React from "react";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import { Box } from "@mui/material";


type AppDataGridProps = {
  rows: any[];
  columns: GridColDef[];
  height?: number | string; // flexible height
  loading?: boolean;
  getRowId?: (row: any) => string | number;
};

const AppDataGrid: React.FC<AppDataGridProps> = ({
  rows,
  columns,
  height = "calc(100vh - 260px)", // 🔑 IMPORTANT
  loading = false,
  getRowId,
}) => {
  return (
    <Box
      sx={{
        height,
        width: "100%",
        backgroundColor: "#fff",
        borderRadius: 2,
        boxShadow: 1,
        overflow: "hidden", // 🔑 page scroll block
      }}
    >
      <DataGrid
        rows={rows}
        columns={columns}
        loading={loading}
        getRowId={getRowId}
        disableRowSelectionOnClick
        hideFooterPagination     // ❌ pagination footer removed
        hideFooterSelectedRowCount
        hideFooter
        sx={{
          border: "none",
          "& .MuiDataGrid-virtualScroller": {
            overflow: "auto", // ✅ only table scroll
          },
          "& .MuiDataGrid-columnHeaders": {
            backgroundColor: "#f9fafb",
            fontWeight: 500,
          },
        }}
      />
    </Box>
  );
};

export default AppDataGrid;
