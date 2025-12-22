import React, { useState } from "react";
import { Task } from "../../services/taskService";
import { Tooltip, IconButton } from "@mui/material";
import { ChevronLeft, ChevronRight } from "@mui/icons-material";

type Props = {
  tasks: Task[];
  showRecentOnly?: boolean; // optional prop
};

const TaskTable: React.FC<Props> = ({ tasks, showRecentOnly = false }) => {
  const displayedTasks = showRecentOnly ? tasks.slice(0, 15) : tasks; // show up to 15 for carousel demo
  const [startIndex, setStartIndex] = useState(0);
  const tasksPerPage = 3; // ✅ show 3 tasks at a time

  // Calculate visible slice
  const visibleTasks = displayedTasks.slice(startIndex, startIndex + tasksPerPage);

  const handleNext = () => {
    if (startIndex + tasksPerPage < displayedTasks.length) {
      setStartIndex(startIndex + tasksPerPage);
    }
  };

  const handlePrev = () => {
    if (startIndex > 0) {
      setStartIndex(startIndex - tasksPerPage);
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-lg flex flex-col overflow-hidden relative">
      {/* Header with navigation buttons */}
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold text-gray-800 text-xl">
          {showRecentOnly ? "Recent Tasks" : "All Tasks"}
        </h4>

        {/* ✅ Carousel navigation */}
        <div className="flex gap-2">
          <IconButton
            onClick={handlePrev}
            disabled={startIndex === 0}
            size="small"
            className="border border-gray-300"
          >
            <ChevronLeft />
          </IconButton>
          <IconButton
            onClick={handleNext}
            disabled={startIndex + tasksPerPage >= displayedTasks.length}
            size="small"
            className="border border-gray-300"
          >
            <ChevronRight />
          </IconButton>
        </div>
      </div>

      {/* ✅ Carousel Table */}
      <div className="overflow-hidden rounded-lg">
        <table className="w-full text-lg border-collapse">
          <thead className="sticky top-0 bg-gray-50 border-b border-gray-100">
            <tr className="text-gray-500">
              <th className="text-left py-3 px-2">Task Name</th>
              <th className="text-left py-3 px-2">Due Date</th>
              <th className="text-left py-3 px-2">Priority</th>
              <th className="text-left py-3 px-2">Status</th>
            </tr>
          </thead>

          <tbody>
            {visibleTasks.length > 0 ? (
              visibleTasks.map((t) => (
                <tr
                  key={t.id}
                  className="border-b border-gray-200 hover:bg-gray-50 transition"
                >
                  <td className="py-3 px-2 font-medium text-sm text-gray-800">
                    {t.name}
                  </td>
                  <td className="text-gray-500 text-sm px-2">
                    {t.dueDate ? new Date(t.dueDate).toDateString() : "—"}
                  </td>
                  <td className="px-2">
                    <span
                      className={`px-3 py-1 rounded-lg text-sm ${
                        t.priority === 2
                          ? "bg-red-100 text-red-600"
                          : t.priority === 1
                          ? "bg-yellow-100 text-yellow-600"
                          : "bg-green-100 text-green-600"
                      }`}
                    >
                      {t.priority === 2
                        ? "High"
                        : t.priority === 1
                        ? "Medium"
                        : "Low"}
                    </span>
                  </td>
                  <td className="text-sm text-gray-600 px-2">
                    {t.completed ? "Completed" : "Pending"}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="text-center text-gray-500 py-6">
                  No tasks found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ✅ Optional page indicator */}
      <div className="text-center text-gray-500 mt-3 text-sm">
        Showing {startIndex + 1}–
        {Math.min(startIndex + tasksPerPage, displayedTasks.length)} of{" "}
        {displayedTasks.length}
      </div>
    </div>
  );
};

export default TaskTable;
