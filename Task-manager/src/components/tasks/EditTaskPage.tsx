// // src/pages/tasks/EditTaskPage.tsx

// import React, { useEffect, useRef, useState } from "react";
// import { useNavigate, useParams } from "react-router-dom";
// import {
//   Box,
//   Button,
//   Grid,
//   TextField,
//   Typography,
//   Divider,
//   Chip,
//   Avatar,
//   IconButton,
//   Stack,
//   Autocomplete,
//   Dialog,
//   DialogTitle,
//   DialogContent,
//   DialogActions,
// } from "@mui/material";

// import CloseIcon from "@mui/icons-material/Close";
// import FormatBoldIcon from "@mui/icons-material/FormatBold";
// import FormatItalicIcon from "@mui/icons-material/FormatItalic";
// import FormatUnderlinedIcon from "@mui/icons-material/FormatUnderlined";
// import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";
// import LinkIcon from "@mui/icons-material/Link";

// import { toast } from "react-toastify";

// import { getTaskById, updateTask, deleteTask } from "../../services/taskService";
// import { getAllUsersIncludingDeleted } from "../../services/userService";

// /* ---------------- helpers --------------------- */
// const richToPlain = (html: string) => {
//   const div = document.createElement("div");
//   div.innerHTML = html;
//   return div.textContent || div.innerText || "";
// };

// const formatDateTime = (iso?: string) => {
//   if (!iso) return "—";
//   try {
//     return new Date(iso).toLocaleString();
//   } catch {
//     return iso;
//   }
// };

// /* ---------------- component ------------------- */
// const EditTaskPage: React.FC = () => {
//   const { id } = useParams<{ id: string }>();
//   const navigate = useNavigate();
//   const editorRef = useRef<HTMLDivElement | null>(null);

//   const [loading, setLoading] = useState(false);

//   // Task fields
//   const [name, setName] = useState("");
//   const [descriptionHtml, setDescriptionHtml] = useState("");
//   // use string[] for IDs (consistent with backend)
//   const [assignedTo, setAssignedTo] = useState<string[]>([]);
//   const [dueDate, setDueDate] = useState<string | "">("");
//   const [priority, setPriority] = useState<0 | 1 | 2>(1);
//   const [completed, setCompleted] = useState(false);

//   const [createdAt, setCreatedAt] = useState<string | undefined>(undefined);
//   const [updatedAt, setUpdatedAt] = useState<string | undefined>(undefined);

//   // users: id is string
//   const [users, setUsers] = useState<
//     { id: string; name: string; isDeleted?: boolean }[]
//   >([]);

//   const [confirmOpen, setConfirmOpen] = useState(false);

//   /* ----------------------------------------------
//       LOAD ALL USERS (ACTIVE + DELETED)
//   ---------------------------------------------- */
//   useEffect(() => {
//     (async () => {
//       try {
//         const u = await getAllUsersIncludingDeleted();
//         // normalize: id as string
//         setUsers(
//           u.map((x) => ({
//             id: String(x.id ?? ""),
//             name: `${x.firstName ?? ""} ${x.lastName ?? ""}`.trim() || String(x.id ?? ""),
//             isDeleted: !!x.isDeleted,
//           }))
//         );
//       } catch (err) {
//         console.error("Failed to load users:", err);
//         toast.error("Failed to load users");
//       }
//     })();
//   }, []);

//   /* ----------------------------------------------
//       LOAD TASK
//   ---------------------------------------------- */
//   useEffect(() => {
//     (async () => {
//       if (!id) {
//         toast.error("Invalid task id");
//         navigate("/tasks");
//         return;
//       }

//       try {
//         // taskService accepts string id
//         const t = await getTaskById(String(id));
//         if (!t) {
//           toast.error("Task not found");
//           navigate("/tasks");
//           return;
//         }

//         setName(t.name ?? t.taskName ?? "");
//         setDescriptionHtml(
//           t.descriptionHtml ??
//             t.descriptionPlain ??
//             t.descrFormattedText ??
//             t.descrPlainText ??
//             ""
//         );

//         // normalize assigned ids to strings
//         const assignedIds = (t.assignedToIds ?? []).map((v: any) => String(v));
//         setAssignedTo(assignedIds);

//         setDueDate(
//           t.dueDate
//             ? typeof t.dueDate === "string"
//               ? t.dueDate.split?.("T")?.[0] ?? String(t.dueDate)
//               : String(t.dueDate)
//             : ""
//         );
//         setPriority((t.priority as 0 | 1 | 2) ?? 1);
//         setCompleted(Boolean(t.completed));
//         setCreatedAt(t.createdAt ? String(t.createdAt) : undefined);
//         setUpdatedAt(t.updatedAt ? String(t.updatedAt) : String(t.createdAt));

//         // Set editor HTML
//         setTimeout(() => {
//           if (editorRef.current) editorRef.current.innerHTML = t.descriptionHtml ?? "";
//         }, 0);
//       } catch (err) {
//         console.error("Failed to load task:", err);
//         toast.error("Failed to load task");
//         navigate("/tasks");
//       }
//     })();
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [id, navigate]);

//   /* ----------------------------------------------
//       KEEP EDITOR SYNCED
//   ---------------------------------------------- */
//   useEffect(() => {
//     if (editorRef.current && descriptionHtml !== editorRef.current.innerHTML) {
//       editorRef.current.innerHTML = descriptionHtml;
//     }
//   }, [descriptionHtml]);

//   /* ----------------------------------------------
//       EXEC COMMAND FOR RICH TEXT
//   ---------------------------------------------- */
//   const exec = (cmd: string, val?: any) => {
//     document.execCommand(cmd, false, val);
//     setTimeout(() => {
//       setDescriptionHtml(editorRef.current?.innerHTML || "");
//     }, 0);
//   };

//   /* ----------------------------------------------
//       VALIDATION
//   ---------------------------------------------- */
//   const validate = () => {
//     if (!name.trim()) {
//       toast.error("Task name is required");
//       return false;
//     }
//     if (name.trim().length > 50) {
//       toast.error("Max 50 chars allowed");
//       return false;
//     }
//     if (!assignedTo || assignedTo.length === 0) {
//       toast.error("Select at least one user");
//       return false;
//     }
//     return true;
//   };

//   /* ----------------------------------------------
//       SAVE TASK
//   ---------------------------------------------- */
//   const handleSave = async () => {
//     if (!validate()) return;

//     const html = editorRef.current?.innerHTML || "";
//     const plain = richToPlain(html);

//     setLoading(true);
//     try {
//       // Build payload. Use id as string
//       const payload: any = {
//         id: String(id),
//         name: name.trim(),
//         descriptionHtml: html,
//         descriptionPlain: plain,
//         assignedToIds: assignedTo, // string[]
//         dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
//         priority,
//         completed,
//         createdAt: createdAt ?? new Date().toISOString(),
//       };

//       const updated = await updateTask(payload as any);
//       setUpdatedAt(updated?.updatedAt ?? new Date().toISOString());
//       toast.success("Task updated");
//       navigate("/tasks");
//     } catch (err) {
//       console.error("Update failed:", err);
//       toast.error("Update failed");
//     } finally {
//       setLoading(false);
//     }
//   };

//   /* ----------------------------------------------
//       DELETE TASK
//   ---------------------------------------------- */
//   const handleConfirmDelete = async () => {
//     try {
//       await deleteTask(String(id));
//       toast.success("Task deleted");
//       navigate("/tasks");
//     } catch (err) {
//       console.error("Delete failed:", err);
//       toast.error("Delete failed");
//     }
//   };

//   /* ----------------------------------------------
//       USER MAP (USEFUL)
//   ---------------------------------------------- */
//   const usersById = users.reduce<Record<string, any>>((acc, u) => {
//     acc[String(u.id)] = u;
//     return acc;
//   }, {});

//   const assignedOptions = assignedTo
//     .map((aid) => usersById[String(aid)])
//     .filter(Boolean);

//   /* ----------------------------------------------
//       ⭐ UPDATED ASSIGNED-TO (DISABLED DELETED USERS)
//   ---------------------------------------------- */
//   const AssignedToBox = (
//     <Box>
//       <Typography variant="body2" mb={1}>
//         Assigned To *
//       </Typography>

//       <Autocomplete
//         multiple
//         options={users}
//         getOptionLabel={(opt) => opt.name + (opt.isDeleted ? " (deleted)" : "")}
//         // value should be array of option objects
//         value={assignedOptions as any}
//         isOptionEqualToValue={(option, value) => String(option.id) === String(value.id)}
//         getOptionDisabled={(opt) => Boolean(opt.isDeleted)} // prevent selecting deleted users
//         onChange={(_event, val) => {
//           // val is array of user objects
//           const validIds = (val as any[]).map((u) => String(u.id));
//           setAssignedTo(validIds);
//         }}
//         renderOption={(props, option) => {
//           const initials = (option.name || "U")
//             .split(" ")
//             .map((s: string) => (s ? s[0] : ""))
//             .slice(0, 2)
//             .join("")
//             .toUpperCase();

//           return (
//             <li
//               {...props}
//               key={String(option.id)}
//               style={{
//                 opacity: option.isDeleted ? 0.5 : 1,
//                 fontStyle: option.isDeleted ? "italic" : "normal",
//                 color: option.isDeleted ? "#b91c1c" : "inherit",
//                 display: "flex",
//                 alignItems: "center",
//               }}
//             >
//               <Avatar
//                 sx={{
//                   width: 28,
//                   height: 28,
//                   bgcolor: option.isDeleted ? "#777" : "#0a54c3",
//                   mr: 2,
//                   fontSize: 12,
//                 }}
//               >
//                 {initials}
//               </Avatar>
//               <span>
//                 {option.name} {option.isDeleted ? "(deleted)" : ""}
//               </span>
//             </li>
//           );
//         }}
//         renderTags={(value, getTagProps) =>
//           value.map((option: any, index: number) => (
//             <Chip
//               label={option.name + (option.isDeleted ? " (deleted)" : "")}
//               avatar={
//                 <Avatar
//                   sx={{
//                     bgcolor: option.isDeleted ? "#777" : "#0a54c3",
//                     width: 24,
//                     height: 24,
//                     fontSize: 12,
//                   }}
//                 >
//                   {(
//                     option.name ||
//                     "U"
//                   )
//                     .split(" ")
//                     .map((s: string) => (s ? s[0] : ""))
//                     .slice(0, 2)
//                     .join("")
//                     .toUpperCase()}
//                 </Avatar>
//               }
//               {...getTagProps({ index })}
//               key={String(option.id)}
//               size="small"
//               sx={{
//                 opacity: option.isDeleted ? 0.6 : 1,
//                 fontStyle: option.isDeleted ? "italic" : "normal",
//                 background: option.isDeleted ? "#f5f5f5" : undefined,
//               }}
//             />
//           ))
//         }
//         renderInput={(params) => (
//           <TextField {...params} size="small" placeholder="Select users..." />
//         )}
//       />
//     </Box>
//   );

//   /* ----------------------------------------------
//       UI
//   ---------------------------------------------- */
//   return (
//     <div className="p-6">
//       <div className="max-w-6xl mx-auto">
//         <Box mb={3}>
//           <Button size="small" onClick={() => navigate("/tasks")}>
//             ← Back to Tasks
//           </Button>
//         </Box>

//         <Box className="bg-white rounded-lg shadow-md p-6">
//           <Grid container spacing={4}>
//             {/* LEFT FORM */}
//             <Grid item xs={12} md={8}>
//               <Box display="flex" justifyContent="space-between">
//                 <Typography variant="h6" fontWeight={700}>
//                   Edit Task
//                 </Typography>
//                 <IconButton onClick={() => navigate("/tasks")}>
//                   <CloseIcon />
//                 </IconButton>
//               </Box>

//               <Box mt={2} className="space-y-4">
//                 <TextField
//                   label="Task Name *"
//                   fullWidth
//                   size="small"
//                   value={name}
//                   onChange={(e) => setName(e.target.value)}
//                   helperText={`${name.length}/50`}
//                   inputProps={{ maxLength: 50 }}
//                 />

//                 {/* Rich Text */}
//                 <Typography variant="subtitle2">Description</Typography>

//                 <div>
//                   <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
//                     <IconButton size="small" onClick={() => exec("bold")}>
//                       <FormatBoldIcon />
//                     </IconButton>
//                     <IconButton size="small" onClick={() => exec("italic")}>
//                       <FormatItalicIcon />
//                     </IconButton>
//                     <IconButton size="small" onClick={() => exec("underline")}>
//                       <FormatUnderlinedIcon />
//                     </IconButton>
//                     <IconButton size="small" onClick={() => exec("insertUnorderedList")}>
//                       <FormatListBulletedIcon />
//                     </IconButton>
//                     <IconButton
//                       size="small"
//                       onClick={() => {
//                         const url = prompt("Enter URL");
//                         if (url) exec("createLink", url);
//                       }}
//                     >
//                       <LinkIcon />
//                     </IconButton>
//                   </Stack>

//                   <div
//                     ref={editorRef}
//                     contentEditable
//                     suppressContentEditableWarning
//                     onInput={() => setDescriptionHtml(editorRef.current?.innerHTML || "")}
//                     style={{
//                       minHeight: 140,
//                       border: "1px solid #e6e6e6",
//                       borderRadius: 6,
//                       padding: 10,
//                       background: "#fff",
//                     }}
//                   />
//                 </div>

//                 {/* ⭐ Updated Assigned To */}
//                 {AssignedToBox}

//                 {/* Date & Priority */}
//                 <Grid container spacing={2}>
//                   <Grid item xs={6}>
//                     <TextField
//                       label="Due Date"
//                       type="date"
//                       size="small"
//                       fullWidth
//                       InputLabelProps={{ shrink: true }}
//                       value={dueDate}
//                       onChange={(e) => setDueDate(e.target.value)}
//                     />
//                   </Grid>

//                   <Grid item xs={6}>
//                     <Typography variant="body2">Priority</Typography>
//                     <Box className="flex gap-2 mt-1">
//                       <Button variant={priority === 0 ? "contained" : "outlined"} onClick={() => setPriority(0)}>
//                         Low
//                       </Button>
//                       <Button variant={priority === 1 ? "contained" : "outlined"} onClick={() => setPriority(1)}>
//                         Medium
//                       </Button>
//                       <Button variant={priority === 2 ? "contained" : "outlined"} onClick={() => setPriority(2)}>
//                         High
//                       </Button>
//                     </Box>
//                   </Grid>
//                 </Grid>

//                 <Box>
//                   <label style={{ display: "flex", gap: 8 }}>
//                     <input type="checkbox" checked={completed} onChange={(e) => setCompleted(e.target.checked)} />
//                     <span>Completed</span>
//                   </label>
//                 </Box>

//                 <Divider />

//                 <Box className="flex gap-3">
//                   <Button variant="contained" sx={{ bgcolor: "#0a54c3" }} onClick={handleSave} disabled={loading}>
//                     {loading ? "Saving..." : "Save Changes"}
//                   </Button>

//                   <Button variant="outlined" onClick={() => navigate("/tasks")}>
//                     Cancel
//                   </Button>
//                 </Box>
//               </Box>
//             </Grid>

//             {/* RIGHT PANEL */}
//             <Grid item xs={12} md={4}>
//               <Box sx={{ border: "1px solid #f0f0f0", p: 2 }}>
//                 <Typography variant="subtitle1" fontWeight={700}>
//                   Status
//                 </Typography>

//                 <Box display="flex" justifyContent="space-between" sx={{ mb: 2 }}>
//                   <Typography variant="body2">Current Status</Typography>
//                   <Box
//                     sx={{
//                       px: 1.2,
//                       py: 0.4,
//                       borderRadius: "999px",
//                       background: completed ? "#e6fff1" : "#e6f4ff",
//                       color: completed ? "#0a8a5a" : "#0a54c3",
//                     }}
//                   >
//                     {completed ? "Completed" : "In Progress"}
//                   </Box>
//                 </Box>

//                 <Divider sx={{ my: 1 }} />

//                 <Typography variant="subtitle2">Details</Typography>

//                 <Box display="flex" justifyContent="space-between">
//                   <Typography variant="caption">Created</Typography>
//                   <Typography variant="caption">{formatDateTime(createdAt)}</Typography>
//                 </Box>

//                 <Box display="flex" justifyContent="space-between">
//                   <Typography variant="caption">Last Updated</Typography>
//                   <Typography variant="caption">{formatDateTime(updatedAt)}</Typography>
//                 </Box>

//                 <Divider sx={{ my: 1 }} />

//                 <Stack spacing={1}>
//                   <Button variant="outlined" color="error" onClick={() => setConfirmOpen(true)}>
//                     Delete Task
//                   </Button>
//                 </Stack>
//               </Box>
//             </Grid>
//           </Grid>
//         </Box>

//         <Box textAlign="center" mt={4} color="gray">
//           © Task Manager 2025
//         </Box>
//       </div>

//       {/* Confirm Delete Dialog */}
//       <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
//         <DialogTitle>Delete Task</DialogTitle>
//         <DialogContent>
//           <Typography>Are you sure you want to delete this task?</Typography>
//         </DialogContent>
//         <DialogActions>
//           <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
//           <Button color="error" variant="contained" onClick={handleConfirmDelete}>
//             Delete
//           </Button>
//         </DialogActions>
//       </Dialog>
//     </div>
//   );
// };

// export default EditTaskPage;
