// src/validators/state.validator.js
import { body } from 'express-validator';

export const insertValidator = [
  body('stateName').exists().withMessage('StateName is required').isString().trim().isLength({ min: 1, max: 50 }),
  body('countryId').exists().withMessage('CountryID is required'),
];

export const updateValidator = [
  body('stateID').exists().withMessage('StateID is required'),
  body('stateName').exists().withMessage('StateName is required').isString().trim().isLength({ min: 1, max: 50 }),
  body('countryId').exists().withMessage('CountryID is required'),
];

export const checkDuplicateValidator = [
  body('StateName').exists().withMessage('StateName is required').isString().trim().isLength({ min: 1, max: 50 }),
  body('CountryID').exists().withMessage('CountryID is required'),
  body('ExcludeID').optional()
];

// default export convenience
export default {
  insertValidator,
  updateValidator,
  checkDuplicateValidator
};
