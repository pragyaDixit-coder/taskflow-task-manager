// src/components/tasks/TaskTable.tsx
import React from "react";
import { Task } from "../../services/taskService";
import { IconButton, Checkbox, Tooltip, Box } from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";

import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import NoRowsMessage from "../../components/common/NoRowsMessage";

type Props = {
  tasks: Task[];
  usersMap: Record<string, string>;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleComplete: (task: Task) => void;
};

/* ---------------- HELPERS (UNCHANGED) ---------------- */

const getDueStatus = (due?: string, completed?: boolean) => {
  if (completed) return { label: "Completed", color: "green" };
  if (!due) return { label: "-", color: "gray" };

  const dueDate = new Date(due);
  const today = new Date();

  dueDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  const diffDays = Math.floor(
    (dueDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000)
  );

  if (diffDays < 0) return { label: "Overdue", color: "red" };
  if (diffDays === 0) return { label: "Today", color: "blue" };
  if (diffDays > 0)
    return {
      label: `Due ${dueDate.toLocaleDateString()}`,
      color: "yellow",
    };

  return { label: "-", color: "gray" };
};

/* ---------------- COMPONENT ---------------- */

const TaskTable: React.FC<Props> = ({
  tasks,
  usersMap,
  onEdit,
  onDelete,
  onToggleComplete,
}) => {
  const columns: GridColDef[] = [
    {
      field: "name",
      headerName: "Task Name",
      flex: 1,
      renderCell: (p) => (
        <span className="font-semibold text-gray-800">{p.row.name}</span>
      ),
    },
    {
      field: "description",
      headerName: "Description",
      flex: 1.5,
      renderCell: (p) => {
        const text = p.row.descriptionPlain || "";
        return (
          <span className="text-sm text-gray-500">
            {text.slice(0, 80)}
            {text.length > 80 ? "..." : ""}
          </span>
        );
      },
    },
    {
      field: "assignedTo",
      headerName: "Assigned To",
      flex: 1,
      renderCell: (p) => (
        <span className="text-sm text-gray-500">
          {(p.row.assignedToIds ?? [])
            .map((id: string) => usersMap[String(id)])
            .filter(Boolean)
            .join(", ") || "-"}
        </span>
      ),
    },
    {
      field: "dueDate",
      headerName: "Due Date",
      width: 130,
      renderCell: (p) => (
        <span className="text-sm text-gray-500">
          {p.row.dueDate ? new Date(p.row.dueDate).toLocaleDateString() : "-"}
        </span>
      ),
    },
    {
      field: "status",
      headerName: "Status",
      width: 150,
      renderCell: (p) => {
        const { label, color } = getDueStatus(p.row.dueDate, p.row.completed);

        const colorClass =
          color === "red"
            ? "bg-red-100 text-red-700"
            : color === "blue"
            ? "bg-blue-100 text-blue-700"
            : color === "green"
            ? "bg-green-100 text-green-700"
            : color === "yellow"
            ? "bg-yellow-100 text-yellow-700"
            : "bg-gray-100 text-gray-700";

        return (
          <span
            className={`text-sm px-3 py-1 rounded-2xl font-medium ${colorClass}`}
          >
            {label}
          </span>
        );
      },
    },
    {
      field: "priority",
      headerName: "Priority",
      width: 130,
      renderCell: (p) =>
        p.row.priority === 0 ? (
          <span className="px-2 py-1 rounded-2xl bg-green-100 text-green-700">
            Low
          </span>
        ) : p.row.priority === 1 ? (
          <span className="px-2 py-1 rounded-2xl bg-yellow-100 text-yellow-700">
            Medium
          </span>
        ) : (
          <span className="px-2 py-1 rounded-2xl bg-red-100 text-red-700">
            High
          </span>
        ),
    },
    {
      field: "completed",
      headerName: "Completed",
      width: 120,
      align: "center",
      renderCell: (p) => (
        <Checkbox
          checked={p.row.completed}
          onChange={() => onToggleComplete(p.row)}
        />
      ),
    },
    {
      field: "actions",
      headerName: "Actions",
      width: 130,
      sortable: false,
      align: "right",
      headerAlign: "right",
      renderCell: (p) => (
        <>
          <Tooltip title="Edit Task" arrow>
            <IconButton size="small" onClick={() => onEdit(p.row.id)}>
              <EditIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete Task" arrow>
            <IconButton size="small" onClick={() => onDelete(p.row.id)}>
              <DeleteIcon color="error" />
            </IconButton>
          </Tooltip>
        </>
      ),
    },
  ];

  return (
    <Box
      sx={{
        minHeight: "200px",
        maxHeight: "60vh",
        overflow: "auto",
        backgroundColor: "#fff",
        borderRadius: "0.5rem",
        border: "1px solid #d1d5db",
        boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
      }}
    >
      <DataGrid
        rows={tasks}
        getRowId={(r) => r.id}
        columns={columns}
        hideFooter
        disableRowSelectionOnClick
        rowHeight={70}
        slots={{
          noRowsOverlay: () => <NoRowsMessage message="No tasks found" />,
        }}
        sx={{
          border: "none",
          p: 2,
          "& .MuiDataGrid-footerContainer": { display: "none" },
          "& .MuiDataGrid-filler": { display: "none" },
          "& .MuiDataGrid-scrollbarFiller": { display: "none" },
          "& .MuiDataGrid-cell": {
            fontSize: "0.945rem",
            color: "#6b7280",
          },
          "& .MuiDataGrid-columnHeaders": {
            backgroundColor: "#f3f4f6",
            fontSize: "1rem",
            fontWeight: 500,
            color: "#6b7280",
          },
          "& .MuiDataGrid-columnHeaderTitle": {
            fontWeight: 600,
          },
        }}
        localeText={{
          noRowsLabel: "No tasks found",
        }}
      />
    </Box>
  );
};

export default TaskTable;
