// src/validators/city.validator.js
import { body, param } from "express-validator";

const insertValidator = [
  body("cityName").exists().withMessage("cityName is required").isString().trim().isLength({ max: 50 }),
  body("stateId").exists().withMessage("stateId is required"),
  body("zipCodes").optional().isArray().withMessage("zipCodes must be an array"),
  body("zipCodes.*").optional().isString().isLength({ max: 6 }).withMessage("zip code max 6 chars"),
];

const updateValidator = [
  body("cityID").exists().withMessage("cityID is required"),
  body("cityName").optional().isString().trim().isLength({ max: 50 }),
  body("stateId").optional(),
  body("zipCodes").optional().isArray(),
  body("zipCodes.*").optional().isString().isLength({ max: 6 }),
];

const checkDuplicateValidator = [
  body("CityName").exists().withMessage("CityName is required"),
  body("StateID").exists().withMessage("StateID is required"),
  body("ExcludeID").optional(),
];

export default {
  insertValidator,
  updateValidator,
  checkDuplicateValidator,
};
