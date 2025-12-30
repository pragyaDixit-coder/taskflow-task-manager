// src/pages/tasks/TaskFormPage.tsx
import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Grid,
  Box,
  Typography,
  Chip,
  Avatar,
  IconButton,
  Stack,
  Autocomplete,
  Divider,
  InputAdornment,
} from "@mui/material";

import CloseIcon from "@mui/icons-material/Close";
import FormatBoldIcon from "@mui/icons-material/FormatBold";
import FormatItalicIcon from "@mui/icons-material/FormatItalic";
import FormatUnderlinedIcon from "@mui/icons-material/FormatUnderlined";
import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";
import LinkIcon from "@mui/icons-material/Link";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import DeleteIcon from "@mui/icons-material/Delete";
import { FileCopy } from "@mui/icons-material";

import { toast } from "react-toastify";

import {
  createTask,
  getTaskById,
  updateTask,
  deleteTask,
} from "../../services/taskService";

import { getAllUsersIncludingDeleted } from "../../services/userService";
import { getCurrentUser } from "../../utils/storage";

/* ---------------- helpers --------------------- */
const richToPlain = (html: string) => {
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.textContent || div.innerText || "";
};

const formatDateTime = (iso?: string) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
};

const todayISODate = (): string => {
  const d = new Date();
  // local YYYY-MM-DD
  const yr = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yr}-${mm}-${dd}`;
};

const isDateInPast = (isoDateString?: string | ""): boolean => {
  if (!isoDateString) return false;
  // compare only date parts (not time)
  try {
    const given = new Date(isoDateString);
    const now = new Date();
    // normalize both to local date midnight
    const givenMid = new Date(
      given.getFullYear(),
      given.getMonth(),
      given.getDate()
    );
    const todayMid = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return givenMid < todayMid;
  } catch {
    return false;
  }
};

/* ---------------- component ------------------- */
const TaskFormPage: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const editorRef = useRef<HTMLDivElement | null>(null);

  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(false);

  // Task fields
  const [name, setName] = useState("");
  const [descriptionHtml, setDescriptionHtml] = useState("");
  const [assignedTo, setAssignedTo] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState<string | "">("");
  const [priority, setPriority] = useState<0 | 1 | 2>(1); // 0 Low, 1 Medium, 2 High
  const [completed, setCompleted] = useState(false); // read-only now

  const [createdAt, setCreatedAt] = useState<string | undefined>(undefined);
  const [updatedAt, setUpdatedAt] = useState<string | undefined>(undefined);

  // users
  const [users, setUsers] = useState<
    { id: string; name: string; isDeleted?: boolean }[]
  >([]);

  const [confirmOpen, setConfirmOpen] = useState(false);

  // track last past-date shown for this value (to avoid repeated toasts previously)
  const [lastPastToastDate, setLastPastToastDate] = useState<string | null>(
    null
  );

  // track if user has edited dueDate in this dialog session
  const [dueDateEdited, setDueDateEdited] = useState(false);

  // validation errors for fields (displayed under fields)
  const [errors, setErrors] = useState<Record<string, string>>({});

  // refs for focusing on invalid controls
  const nameRef = useRef<HTMLInputElement | null>(null);
  const dueDateRef = useRef<HTMLInputElement | null>(null);
  const assignedInputRef = useRef<HTMLInputElement | null>(null);

  /* load users */
  useEffect(() => {
    (async () => {
      try {
        const u = await getAllUsersIncludingDeleted();
        setUsers(
          u.map((x) => ({
            id: String(x.id ?? ""),
            name:
              `${x.firstName ?? ""} ${x.lastName ?? ""}`.trim() ||
              String(x.id ?? ""),
            isDeleted: !!x.isDeleted,
          }))
        );
      } catch (err) {
        console.error(err);
        toast.error("Failed to load users");
      }
    })();
  }, []);

  /* load task if edit */
  useEffect(() => {
    if (!isEdit) {
      setCreatedAt(new Date().toISOString());
      setUpdatedAt(new Date().toISOString());
      // For new tasks, dueDateEdited should remain false until user interacts
      setDueDateEdited(false);
      setErrors({});
      return;
    }

    (async () => {
      if (!id) {
        toast.error("Invalid task id");
        navigate("/tasks");
        return;
      }
      try {
        const t: any = await getTaskById(String(id));
        if (!t) {
          toast.error("Task not found");
          navigate("/tasks");
          return;
        }

        setName(t.name ?? "");
        setDescriptionHtml(t.descriptionHtml ?? t.descriptionPlain ?? "");
        setAssignedTo((t.assignedToIds ?? []).map((v: any) => String(v)));
        setDueDate(
          t.dueDate
            ? typeof t.dueDate === "string"
              ? t.dueDate.split("T")[0]
              : String(t.dueDate)
            : ""
        );
        setPriority((t.priority as 0 | 1 | 2) ?? 1);
        setCompleted(Boolean(t.completed));
        setCreatedAt(t.createdAt ? String(t.createdAt) : undefined);
        setUpdatedAt(t.updatedAt ? String(t.updatedAt) : String(t.createdAt));

        // Important: do NOT mark dueDateEdited true here — we don't want to show the past-date error on initial load
        setDueDateEdited(false);
        setLastPastToastDate(null);
        setErrors({});

        setTimeout(() => {
          if (editorRef.current)
            editorRef.current.innerHTML = t.descriptionHtml ?? "";
        }, 0);
      } catch (err) {
        console.error(err);
        toast.error("Failed to load task");
        navigate("/tasks");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  /* keep editor in sync */
  useEffect(() => {
    if (editorRef.current && descriptionHtml !== editorRef.current.innerHTML) {
      editorRef.current.innerHTML = descriptionHtml;
    }
  }, [descriptionHtml]);

  /* rich text exec */
  const exec = (cmd: string, val?: any) => {
    document.execCommand(cmd, false as any, val);
    setTimeout(() => {
      setDescriptionHtml(editorRef.current?.innerHTML || "");
    }, 0);
  };

  /* Real-time check: if user manually types a past date, show an inline error (not toast)
     NOTE: only when user has actively edited the due date in this dialog (dueDateEdited === true).
     IMPORTANT: Do NOT show or block with due-date errors on Edit mode initial load.
  */
  useEffect(() => {
    if (!dueDate) {
      // reset tracked date when field cleared or changed to empty
      setLastPastToastDate(null);
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy.dueDate;
        return copy;
      });
      return;
    }

    // If we're in edit mode, do not show dueDate inline errors on load.
    // Also, only show real-time due-date errors for Add mode (when creating).
    if (isEdit) {
      // clear any dueDate error while editing existing task unless user actively edits it
      // (we treat it as permissive unless user changes it in this session)
      if (!dueDateEdited) {
        setErrors((prev) => {
          const copy = { ...prev };
          delete copy.dueDate;
          return copy;
        });
        return;
      }
      // If user *has* edited the due date while editing, still allow real-time check:
      // (This follows previous behavior where editing to an invalid past date should show error)
    }

    // For Add mode or when user actively edits dueDate in Edit mode:
    if (isDateInPast(dueDate)) {
      // set inline error
      setErrors((prev) => ({
        ...prev,
        dueDate: "Due date cannot be in the past",
      }));
      setLastPastToastDate(dueDate);
    } else {
      // clear dueDate error
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy.dueDate;
        return copy;
      });
      setLastPastToastDate(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dueDate, dueDateEdited, isEdit]);

  /* validation - collects errors into `errors` state and focuses first invalid field */
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) newErrors.name = "Task name is required";
    else if (name.trim().length > 50)
      newErrors.name = "Task name cannot exceed 50 characters";

    if (!assignedTo || assignedTo.length === 0)
      newErrors.assignedTo = "Assign at least one user";

    // Due date is required
    if (!dueDate) {
      newErrors.dueDate = "Due date is required";
    }

    // Due date cannot be in the past — enforce only when creating (Add). Do NOT block save on edit unless user changed it to invalid.
    if (!isEdit && dueDate && isDateInPast(dueDate))
      newErrors.dueDate = "Due date cannot be in the past";

    // If editing and user explicitly edited the due date in this session, validate it as well
    if (isEdit && dueDateEdited && dueDate && isDateInPast(dueDate))
      newErrors.dueDate = "Due date cannot be in the past";

    setErrors(newErrors);

    // focus first invalid field
    if (Object.keys(newErrors).length > 0) {
      if (newErrors.name && nameRef.current) {
        nameRef.current.focus();
      } else if (newErrors.assignedTo && assignedInputRef.current) {
        // focus assigned autocomplete input
        assignedInputRef.current.focus();
      } else if (newErrors.dueDate && dueDateRef.current) {
        dueDateRef.current.focus();
      }
      return false;
    }

    return true;
  };

  /* save (create/update) */
  const handleSave = async () => {
    // validate and show inline helper messages; do NOT use toasts for validation errors
    if (!validate()) return;

    const html = editorRef.current?.innerHTML || "";
    const plain = richToPlain(html);

    setLoading(true);
    try {
      const currentUser = await getCurrentUser();

      if (isEdit && id) {
        const payload: any = {
          id: String(id),
          name: name.trim(),
          descriptionHtml: html,
          descriptionPlain: plain,
          assignedToIds: assignedTo,
          dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
          priority,
          // completed is intentionally NOT updated via this form (read-only)
          completed,
          createdAt: createdAt ?? new Date().toISOString(),
          createdById: undefined,
        };

        try {
          const existing = await getTaskById(String(id));
          if (existing && existing.createdById)
            payload.createdById = existing.createdById;
          else if (currentUser?.id)
            payload.createdById = String(currentUser.id);
        } catch {
          if (currentUser?.id) payload.createdById = String(currentUser.id);
        }

        const updated = await updateTask(payload as any);
        setUpdatedAt(updated?.updatedAt ?? new Date().toISOString());
        toast.success("Task updated");
      } else {
        const payload: any = {
          name: name.trim(),
          descriptionHtml: html,
          descriptionPlain: plain,
          assignedToIds: assignedTo,
          dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
          priority,
          // new tasks default to not completed
          completed: false,
          createdById: currentUser?.id ? String(currentUser.id) : undefined,
        };

        await createTask(payload as any);
        toast.success("Task created");
      }

      setOpen(false);
      navigate("/tasks");
    } catch (err) {
      console.error(err);
      toast.error("Save failed");
    } finally {
      setLoading(false);
    }
  };

  /* delete */
  const handleConfirmDelete = async () => {
    if (!id) return;
    try {
      await deleteTask(String(id));
      toast.success("Task deleted");
      navigate("/tasks");
    } catch (err) {
      console.error(err);
      toast.error("Delete failed");
    }
  };

  /* helpers for assigned UI */
  const usersById = users.reduce<Record<string, any>>((acc, u) => {
    acc[u.id] = u;
    return acc;
  }, {});
  const assignedOptions = assignedTo.map((a) => usersById[a]).filter(Boolean);

  /* AssignedTo Autocomplete component */
  const AssignedToBox = (
    <Box>
      <Typography variant="body2" mb={1}>
        Assigned To <span className="text-red-500">*</span>
      </Typography>

      <Autocomplete
        multiple
        options={users}
        getOptionLabel={(opt) => opt.name + (opt.isDeleted ? " (deleted)" : "")}
        value={assignedOptions as any}
        isOptionEqualToValue={(option, value) =>
          String(option.id) === String(value.id)
        }
        getOptionDisabled={(opt) => Boolean(opt.isDeleted)}
        onChange={(_event, val) => {
          const ids = (val as any[]).map((v) => String(v.id));
          setAssignedTo(ids);
          // clear assignedTo error when selecting
          setErrors((prev) => {
            const copy = { ...prev };
            delete copy.assignedTo;
            return copy;
          });
        }}
        renderOption={(props, option) => {
          const initials = (option.name || "U")
            .split(" ")
            .map((s: string) => (s ? s[0] : ""))
            .slice(0, 2)
            .join("")
            .toUpperCase();

          return (
            <li
              {...props}
              key={String(option.id)}
              style={{
                opacity: option.isDeleted ? 0.5 : 1,
                fontStyle: option.isDeleted ? "italic" : "normal",
                display: "flex",
                alignItems: "center",
              }}
            >
              <Avatar
                sx={{
                  width: 28,
                  height: 28,
                  bgcolor: option.isDeleted ? "#777" : "#0a54c3",
                  mr: 2,
                  fontSize: 12,
                }}
              >
                {initials}
              </Avatar>
              <span>
                {option.name} {option.isDeleted ? "(deleted)" : ""}
              </span>
            </li>
          );
        }}
        renderTags={(value, getTagProps) =>
          value.map((option: any, index: number) => (
            <Chip
              label={option.name + (option.isDeleted ? " (deleted)" : "")}
              avatar={
                <Avatar
                  sx={{
                    bgcolor: option.isDeleted ? "#777" : "#0a54c3",
                    width: 24,
                    height: 24,
                    fontSize: 12,
                  }}
                >
                  {(option.name || "U")
                    .split(" ")
                    .map((s: string) => (s ? s[0] : ""))
                    .slice(0, 2)
                    .join("")
                    .toUpperCase()}
                </Avatar>
              }
              {...getTagProps({ index })}
              key={String(option.id)}
              size="small"
              sx={{
                mr: 0.5,
                opacity: option.isDeleted ? 0.6 : 1,
                fontStyle: option.isDeleted ? "italic" : "normal",
                background: option.isDeleted ? "#f5f5f5" : "#eef6ff",
                border: option.isDeleted
                  ? "1px solid #eee"
                  : "1px solid rgba(10,84,195,0.12)",
              }}
            />
          ))
        }
        renderInput={(params) => (
          <div>
            <TextField
              {...params}
              size="small"
              placeholder="Search users..."
              inputRef={(el) => {
                assignedInputRef.current = el;
              }}
              error={Boolean(errors.assignedTo)}
            />
            {/* inline error for assignedTo */}
            {errors.assignedTo && (
              <Typography variant="caption" color="error" sx={{ mt: 0.5 ,ml:1.5}}>
                {errors.assignedTo}
              </Typography>
            )}
          </div>
        )}
      />
    </Box>
  );

  /* ----------------- UI ------------------ */
  return (
    <Dialog
      open={open}
      maxWidth="md"
      fullWidth
      // 🧠 IMPORTANT: backdrop click / Esc se close NA ho
      // sirf Cancel button ya Close icon se close hoga
      onClose={(_event, reason) => {
        if (reason === "backdropClick" || reason === "escapeKeyDown") {
          toast.info("Please click the Cancel button to close the dialog.");
          return;
        }
        setOpen(false);
        navigate("/tasks");
      }}
    >
      <DialogTitle 
      component="div"
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Typography variant="h6" fontWeight={700} fontSize={24}>
          <span className="text-gradient bg-clip-text text-transparent bg-linear-to-r from-[#007bff] to-[#0a54c3]">
            {isEdit ? "Edit" : "New"}
          </span>{" "}
          Task
        </Typography>
        <IconButton
          onClick={() => {
            setOpen(false);
            navigate("/tasks");
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Grid container spacing={3}>
          {/* LEFT */}
          <Grid item xs={12} md={8}>
            <Typography variant="body2" mb={1}>
              Task Name <span className="text-red-500">*</span>
            </Typography>
            <TextField
              inputRef={nameRef}
              label="Task Name"
              fullWidth
              size="small"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                // clear name error on change
                setErrors((prev) => {
                  const copy = { ...prev };
                  delete copy.name;
                  return copy;
                });
              }}
              helperText={errors.name ? errors.name : `${name.length}/50`}
              error={Boolean(errors.name)}
              inputProps={{ maxLength: 50 }}
            />

            <Box mt={2}>
              <Typography variant="subtitle2" mb={1}>
                Description
              </Typography>

              <Stack direction="row" spacing={1} mb={1}>
                <IconButton size="small" onClick={() => exec("bold")}>
                  <FormatBoldIcon />
                </IconButton>
                <IconButton size="small" onClick={() => exec("italic")}>
                  <FormatItalicIcon />
                </IconButton>
                <IconButton size="small" onClick={() => exec("underline")}>
                  <FormatUnderlinedIcon />
                </IconButton>
                <IconButton
                  size="small"
                  onClick={() => exec("insertUnorderedList")}
                >
                  <FormatListBulletedIcon />
                </IconButton>
                <IconButton
                  size="small"
                  onClick={() => {
                    const url = prompt("Enter URL");
                    if (url) exec("createLink", url);
                  }}
                >
                  <LinkIcon />
                </IconButton>
                <IconButton
                  size="small"
                  onClick={() => {
                    if (editorRef.current) {
                      editorRef.current.innerHTML = "";
                      setDescriptionHtml("");
                    }
                  }}
                >
                  <DeleteIcon />
                </IconButton>
                <IconButton
                  size="small"
                  onClick={() => {
                    if (editorRef.current && navigator.clipboard) {
                      navigator.clipboard
                        .writeText(editorRef.current.innerHTML)
                        .catch(() => {});
                    }
                  }}
                >
                  <FileCopy />
                </IconButton>
              </Stack>

              <Box
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                onInput={() =>
                  setDescriptionHtml(editorRef.current?.innerHTML || "")
                }
                sx={{
                  minHeight: 140,
                  border: "1px solid #e6e6e6",
                  borderRadius: "6px",
                  p: 1.25,
                  background: "#fff",
                }}
              />
            </Box>

            <Box mt={2}>{AssignedToBox}</Box>

            <Grid container spacing={2} mt={0.5}>
              <Grid item xs={6}>
                <Typography variant="body2" mb={0.5}>
                  Due Date <span className="text-red-500">*</span>
                </Typography>
                <TextField
                  inputRef={dueDateRef}
                  type="date"
                  size="small"
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  value={dueDate}
                  onChange={(e) => {
                    setDueDate(e.target.value);
                    // mark that user actively edited the due date in this dialog
                    setDueDateEdited(true);
                    // clear dueDate error on change (real-time effect will set again if invalid)
                    setErrors((prev) => {
                      const copy = { ...prev };
                      delete copy.dueDate;
                      return copy;
                    });
                  }}
                  inputProps={{
                    min: todayISODate(), // prevent picking past dates
                  }}
                 
                  error={Boolean(errors.dueDate)}
                  helperText={errors.dueDate ?? ""}
                />
              </Grid>

              <Grid item xs={6}>
                <Typography variant="body2" mb={0.5}>
                  Priority
                </Typography>

                <Stack direction="row" spacing={1} mt={1}>
                  {/* Low */}
                  <Button
                    size="small"
                    variant={priority === 0 ? "contained" : "outlined"}
                    onClick={() => setPriority(0)}
                    sx={{
                      minWidth: 72,
                      borderColor:
                        priority === 0 ? "#28a745" : "rgba(0,0,0,0.12)",
                      color: priority === 0 ? "#fff" : "#28a745",
                      background: priority === 0 ? "#28a745" : "transparent",
                      "&:hover": {
                        background:
                          priority === 0 ? "#218838" : "rgba(0,0,0,0.04)",
                      },
                    }}
                  >
                    Low
                  </Button>

                  {/* Medium */}
                  <Button
                    size="small"
                    variant={priority === 1 ? "contained" : "outlined"}
                    onClick={() => setPriority(1)}
                    sx={{
                      minWidth: 72,
                      borderColor:
                        priority === 1 ? "#ff9800" : "rgba(0,0,0,0.12)",
                      color: priority === 1 ? "#fff" : "#ff9800",
                      background: priority === 1 ? "#ff9800" : "transparent",
                      "&:hover": {
                        background:
                          priority === 1 ? "#fb8c00" : "rgba(0,0,0,0.04)",
                      },
                    }}
                  >
                    Medium
                  </Button>

                  {/* High */}
                  <Button
                    size="small"
                    variant={priority === 2 ? "contained" : "outlined"}
                    onClick={() => setPriority(2)}
                    sx={{
                      minWidth: 72,
                      borderColor:
                        priority === 2 ? "#e53935" : "rgba(0,0,0,0.12)",
                      color: priority === 2 ? "#fff" : "#e53935",
                      background: priority === 2 ? "#e53935" : "transparent",
                      "&:hover": {
                        background:
                          priority === 2 ? "#d32f2f" : "rgba(0,0,0,0.04)",
                      },
                    }}
                  >
                    High
                  </Button>
                </Stack>
              </Grid>
            </Grid>

            {/* NOTE: Completed checkbox removed from the editable form as requested */}
          </Grid>

          {/* RIGHT */}
          <Grid item xs={12} md={4}>
            <Box
              sx={{
                border: "2px solid #f0f0f0",
                p: 2,
                borderRadius: 1,
                background: "#fff",
              }}
            >
              <Typography variant="subtitle1" fontWeight={700} mb={2}>
                Status
              </Typography>

              <Box
                display="flex"
                justifyContent="space-between"
                alignItems="center"
                mb={1}
              >
                <Typography variant="body2">Current Status</Typography>
                <Box
                  sx={{
                    px: 1.25,
                    py: 0.35,
                    borderRadius: "999px",
                    background: completed ? "#e6fff6" : "#e8f4ff",
                    color: completed ? "#0a8a5a" : "#0a54c3",
                    fontSize: 12,
                  }}
                >
                  {completed ? "Completed" : "In Progress"}
                </Box>
              </Box>

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle2" fontWeight={700} mb={1}>
                Details
              </Typography>

              <Box display="flex" justifyContent="space-between" mb={1}>
                <Typography variant="caption">Created</Typography>
                <Typography variant="caption">
                  {formatDateTime(createdAt)}
                </Typography>
              </Box>

              <Box display="flex" justifyContent="space-between" mb={1}>
                <Typography variant="caption">Created By</Typography>
                <Typography variant="caption">You</Typography>
              </Box>

              <Box display="flex" justifyContent="space-between" mb={1}>
                <Typography variant="caption">Last Updated</Typography>
                <Typography variant="caption">
                  {formatDateTime(updatedAt)}
                </Typography>
              </Box>

              <Box display="flex" justifyContent="space-between" mb={1}>
                <Typography variant="caption">Project</Typography>
                <Typography
                  variant="caption"
                  sx={{ color: "#0a54c3", cursor: "pointer" }}
                >
                  Task Manager
                </Typography>
              </Box>

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle2" fontWeight={700} mb={2}>
                Quick Actions
              </Typography>

              <Stack spacing={2}>
                <Button
                  variant="outlined"
                  fullWidth
                  onClick={() => {
                    const snapshot = {
                      name,
                      descriptionHtml,
                      assignedTo,
                      dueDate,
                      priority,
                      completed,
                    };
                    navigator.clipboard
                      ?.writeText(JSON.stringify(snapshot))
                      .then(() => {
                        toast.info(
                          "Task snapshot copied to clipboard (duplicate)."
                        );
                      })
                      .catch(() => {
                        toast.info("Could not copy snapshot.");
                      });
                  }}
                >
                  Duplicate Task
                </Button>

                <Button
                  variant="outlined"
                  fullWidth
                  onClick={() => toast.info("Reminder set (placeholder)")}
                >
                  Set Reminder
                </Button>

                {isEdit && (
                  <Button
                    variant="contained"
                    color="error"
                    fullWidth
                    onClick={() => {
                      // only allow deletion if task is completed
                      if (!completed) {
                        toast.error(
                          "This task is not completed — you can't delete it."
                        );
                        return;
                      }
                      setConfirmOpen(true);
                    }}
                  >
                    Delete Task
                  </Button>
                )}
              </Stack>
            </Box>
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions sx={{ background: "#fff", px: 3 }}>
        <Box
          sx={{
            borderRadius: 1,
            border: "1px solid #007bff",
            px: 3,
          }}
        >
          <Button
            onClick={() => {
              setOpen(false);
              navigate("/tasks");
            }}
          >
            Cancel
          </Button>
        </Box>

        <Box>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={loading}
            sx={{
              background: "linear-gradient(90deg,#007bff,#0a54c3)",
              color: "#fff",
              px: 3,
              py: 1,
              "&:hover": {
                background: "linear-gradient(90deg,#007bff,#0849ab)",
              },
            }}
          >
            {loading ? "Saving..." : isEdit ? "Save Task" : "Save Task"}
          </Button>
        </Box>
      </DialogActions>

      {/* delete confirm */}
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>Delete Task</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete this task?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            onClick={async () => {
              setConfirmOpen(false);
              await handleConfirmDelete();
            }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
};

export default TaskFormPage;
