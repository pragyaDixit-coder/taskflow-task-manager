// models/task.model.js
import mongoose from "mongoose";

const { Schema, model } = mongoose;

const TaskSchema = new Schema(
  {
    taskName: { type: String, required: true, maxlength: 50 },
    descrPlainText: { type: String, default: "" },
    descrFormattedText: { type: String, default: "" },

    // multi-select: ek task multiple users ko assign ho sakta hai
    assignedTo: [{ type: Schema.Types.ObjectId, ref: "User" }],

    dueDate: { type: Date, default: null },

    // 0 = Low, 1 = Medium, 2 = High
    priority: { type: Number, enum: [0, 1, 2], default: 0 },

    completed: { type: Boolean, default: false },
    completedByUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    completedOn: { type: Date, default: null },

    // Soft delete flag (future use): list queries me filter { isDeleted: { $ne: true } } laga sakte ho
    isDeleted: { type: Boolean, default: false },

    // default audit fields
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: { createdAt: "createdOn", updatedAt: "updatedOn" },
  }
);

// Existing index for due date + priority (sorting/filter ke liye)
TaskSchema.index({ dueDate: 1, priority: 1 });

// Naya index: per-user task listing fast banane ke liye
TaskSchema.index({ createdBy: 1, dueDate: 1 });

export default model("Task", TaskSchema);
