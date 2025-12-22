// src/components/tasks/TaskCard.tsx
import React from "react";
import { Task } from "../../services/taskService";
import { Avatar, IconButton, Switch, Tooltip } from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";

type Props = {
  task: Task;
  usersMap: Record<string, string>; // keys are string IDs now
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleComplete: (task: Task) => void;
};

const TaskCard: React.FC<Props> = ({
  task,
  usersMap,
  onEdit,
  onDelete,
  onToggleComplete,
}) => {
  // 🔹 Due Status Logic
  const dueStatus = task.completed
    ? "Completed"
    : task.dueDate
    ? (() => {
        const d = new Date(task.dueDate);
        const now = new Date();
        const diff = Math.floor((d.getTime() - now.getTime()) / (24 * 3600 * 1000));
        if (diff < 0) return "Overdue";
        if (diff === 0) return "Today";
        if (diff === 1) return "Tomorrow";
        return `Due ${d.toLocaleDateString()}`;
      })()
    : "";

  // 🔹 Style if task completed
  const completedClass = task.completed
    ? "bg-gray-100 opacity-70"
    : "bg-white hover:shadow-md";

  // 🔹 Badge color
  const dueColorClass = task.completed
    ? "bg-green-100 text-green-700"
    : dueStatus === "Overdue"
    ? "bg-red-100 text-red-700"
    : dueStatus === "Today"
    ? "bg-blue-100 text-blue-700"
    : dueStatus.startsWith("Due")
    ? "bg-yellow-100 text-yellow-700"
    : "bg-green-100 text-green-700";

  // avatar sizing + overlap config
  const AVATAR_SIZE = 32; // px
  const OVERLAP = 12; // px overlap amount
  const VISIBLE_COUNT = 3;

  return (
    <div
      className={`rounded p-4 shadow-sm border border-gray-200 flex justify-between items-start gap-4 px-4 py-5 transition-all duration-200 ${completedClass}`}
    >
      {/* Left section: Task info */}
      <div className="flex-1">
        <div className="font-semibold text-lg flex items-center gap-2">
          {task.name}
          {task.completed && (
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-2xl font-medium">
              Completed
            </span>
          )}
        </div>
        <div className="text-md text-gray-600 mt-1">
          {(task.descriptionPlain || "").slice(0, 120)}
          {(task.descriptionPlain || "").length > 120 ? "..." : ""}
        </div>
      </div>

      {/* Right section */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex flex-col items-start gap-2 text-sm">
          {/* 🔹 Assigned Avatars (absolute overlap with +N) */}
          <div className="flex items-center">
            <span className="font-semibold text-gray-500 mr-2">Assigned:</span>

            {/* relative container that holds absolute-positioned avatars */}
            <div
              style={{
                position: "relative",
                width: `${Math.min(task.assignedToIds.length, VISIBLE_COUNT) * (AVATAR_SIZE - OVERLAP) + OVERLAP}px`,
                height: `${AVATAR_SIZE}px`,
              }}
            >
              {task.assignedToIds.length > 0 ? (
                (() => {
                  const visible = task.assignedToIds.slice(0, VISIBLE_COUNT);
                  const remaining = task.assignedToIds.length - visible.length;

                  return (
                    <>
                      {visible.map((id, index) => {
                        const key = String(id);
                        const name = usersMap[key];
                        if (!name) return null;
                        const initials = name
                          .split(" ")
                          .map((n) => (n ? n[0] : ""))
                          .join("")
                          .toUpperCase();
                        const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(
                          name
                        )}&background=0a54c3&color=fff`;

                        const left = index * (AVATAR_SIZE - OVERLAP);

                        return (
                          <Tooltip key={key} title={name} arrow>
                            <Avatar
                              src={avatarUrl}
                              alt={name}
                              sx={{
                                width: AVATAR_SIZE,
                                height: AVATAR_SIZE,
                                border: "2px solid white",
                                cursor: "pointer",
                                position: "absolute",
                                left: `${left}px`,
                                zIndex: 100 + (VISIBLE_COUNT - index),
                                transition: "transform 0.15s ease, z-index 0.15s ease",
                                "&:hover": {
                                  transform: "scale(1.08)",
                                  zIndex: 999,
                                },
                                boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                                objectFit: "cover",
                              }}
                            >
                              {initials}
                            </Avatar>
                          </Tooltip>
                        );
                      })}

                      {remaining > 0 && (
                        <Tooltip
                          title={task.assignedToIds
                            .slice(VISIBLE_COUNT)
                            .map((id) => usersMap[String(id)])
                            .filter(Boolean)
                            .join(", ")}
                          arrow
                        >
                          <Avatar
                            sx={{
                              width: AVATAR_SIZE,
                              height: AVATAR_SIZE,
                              position: "absolute",
                              left: `${visible.length * (AVATAR_SIZE - OVERLAP)}px`,
                              zIndex: 90,
                              marginLeft: 0,
                              backgroundColor: "#eef2ff",
                              color: "#0a54c3",
                              fontSize: "0.8rem",
                              fontWeight: 600,
                              border: "2px solid white",
                              boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                            }}
                          >
                            +{remaining}
                          </Avatar>
                        </Tooltip>
                      )}
                    </>
                  );
                })()
              ) : (
                <span className="text-gray-400 text-xs ml-2">Unassigned</span>
              )}
            </div>
          </div>

          {/* 🔹 Due Status */}
          <div>
            <span className="font-semibold text-gray-500">Due: </span>
            <span
              className={`px-2 py-1 rounded-2xl text-xs font-medium ${dueColorClass}`}
            >
              {dueStatus}
            </span>
          </div>

          {/* 🔹 Priority */}
          <div>
            <span className="font-semibold text-gray-500">Priority: </span>
            <span
              className={`px-2 py-1 rounded-2xl text-xs font-medium ${
                task.priority === 2
                  ? "bg-red-100 text-red-700"
                  : task.priority === 1
                  ? "bg-yellow-100 text-yellow-700"
                  : "bg-green-100 text-green-700"
              }`}
            >
              {task.priority === 2 ? "High" : task.priority === 1 ? "Medium" : "Low"}
            </span>
          </div>
        </div>

        {/* 🔹 Action Buttons */}
        <div className="flex items-center mt-3 sm:mt-5 gap-2">
          <Tooltip
            title={task.completed ? "Mark as Incomplete" : "Mark as Complete"}
            arrow
          >
            <Switch
              checked={task.completed}
              onChange={() => onToggleComplete(task)}
              color="primary"
            />
          </Tooltip>

          <Tooltip title="Edit Task" arrow>
            <IconButton size="small" onClick={() => onEdit(String(task.id))}>
              <EditIcon />
            </IconButton>
          </Tooltip>

          <Tooltip title="Delete Task" arrow>
            <IconButton size="small" onClick={() => onDelete(String(task.id))}>
              <DeleteIcon color="error" />
            </IconButton>
          </Tooltip>
        </div>
      </div>
    </div>
  );
};

export default TaskCard;
