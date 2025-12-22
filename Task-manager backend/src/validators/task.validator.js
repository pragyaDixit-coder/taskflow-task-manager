// validators/task.validator.js
import { body, param } from 'express-validator';

export const createTask = [
  body('taskName').exists().withMessage('TaskName is required').isLength({ max: 50 }),
  body('assignedTo').isArray({ min: 1 }).withMessage('At least one assigned user required'),
  body('priority').optional().isIn([0,1,2]),
  body('dueDate').optional().isISO8601().toDate(),
];

export const updateTask = [
  param('id').isMongoId(),
  body('taskName').optional().isLength({ max: 50 }),
  body('assignedTo').optional().isArray(),
  body('priority').optional().isIn([0,1,2]),
  body('dueDate').optional().isISO8601().toDate(),
  body('completed').optional().isBoolean(),
];

export const markComplete = [
  param('id').isMongoId(),
  body('completed').isBoolean(),
];
