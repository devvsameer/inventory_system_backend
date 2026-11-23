import { body, query, param, validationResult } from "express-validator";
import { findBySku } from "../services/ProductModel.js";

const RESERVED_SKUS = ["LOW-STOCK"];
const MAX_INT = 2147483647; // Postgres INT limit

// Shared final step: return 400 with all collected errors, otherwise continue.
const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const ValidataionListquery = [
  query("search")
    .optional()
    .isString().withMessage("Search must be a string").bail()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Search can't be empty and can't be more than 100 characters"),
  query("page")
    .optional()
    .isInt({ min: 1 }).withMessage("Page number can't be less than 1"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),
  handleValidation,
];

const ValidateSku = [
  param("sku")
    .isString().withMessage("SKU must be a string").bail()
    .trim()
    .toUpperCase()
    .notEmpty().withMessage("SKU is required").bail()
    .isLength({ min: 3, max: 100 })
    .withMessage("SKU must be between 3 and 100 characters").bail()
    .matches(/^[A-Z0-9_-]+$/)
    .withMessage("SKU can only contain letters, numbers, hyphens and underscores"),
  handleValidation,
];

const ValidateProduct = [
  body("name")
    .isString().withMessage("Name must be a string").bail()
    .trim()
    .notEmpty().withMessage("Name is required").bail()
    .isLength({ min: 3, max: 100 })
    .withMessage("Name must be between 3 and 100 characters"),

  body("sku")
    .isString().withMessage("SKU must be a string").bail()
    .trim()
    .toUpperCase()
    .notEmpty().withMessage("SKU is required").bail()
    .isLength({ min: 3, max: 100 })
    .withMessage("SKU must be between 3 and 100 characters").bail()
    .matches(/^[A-Z0-9_-]+$/)
    .withMessage("SKU can only contain letters, numbers, hyphens and underscores").bail()
    .custom((value) => {
      if (RESERVED_SKUS.includes(value)) {
        throw new Error("SKU is reserved");
      }
      return true;
    })
    .custom(async (value) => {
      const existing = await findBySku(value);
      if (existing) {
        throw new Error("SKU already exists");
      }
    }),

  body("price")
    .notEmpty().withMessage("Price is required").bail()
    .isFloat({ gt: 0, max: 99999999.99 })
    .withMessage("Price must be a number greater than 0").bail()
    .isDecimal({ decimal_digits: "0,2" })
    .withMessage("Price can have at most 2 decimal places"),

  body("stock")
    .optional()
    .isInt({ min: 0, max: MAX_INT })
    .withMessage("Stock must be a non-negative whole number"),

  body("low_stock_threshold")
    .optional()
    .isInt({ min: 2, max: 20 })
    .withMessage("Low stock threshold must be a whole number between 2 and 20"),

  handleValidation,
];

const ValidateProductUpdate = [
  param("sku")
    .isString().withMessage("SKU must be a string").bail()
    .trim()
    .toUpperCase()
    .notEmpty().withMessage("SKU is required").bail()
    .isLength({ min: 3, max: 100 })
    .withMessage("SKU must be between 3 and 100 characters").bail()
    .matches(/^[A-Z0-9_-]+$/)
    .withMessage("SKU can only contain letters, numbers, hyphens and underscores"),

  // SKU is immutable: reject it if it appears in the body at all.
  body("sku").custom((value) => {
    if (value !== undefined) {
      throw new Error("SKU can't be changed");
    }
    return true;
  }),

  body("name")
    .isString().withMessage("Name must be a string").bail()
    .trim()
    .notEmpty().withMessage("Name is required").bail()
    .isLength({ min: 3, max: 100 })
    .withMessage("Name must be between 3 and 100 characters"),

  body("price")
    .notEmpty().withMessage("Price is required").bail()
    .isFloat({ gt: 0, max: 99999999.99 })
    .withMessage("Price must be a number greater than 0").bail()
    .isDecimal({ decimal_digits: "0,2" })
    .withMessage("Price can have at most 2 decimal places"),

  // Required on update: the controller always writes both columns.
  body("stock")
    .notEmpty().withMessage("Stock is required").bail()
    .isInt({ min: 0, max: MAX_INT })
    .withMessage("Stock must be a non-negative whole number"),

  body("low_stock_threshold")
    .notEmpty().withMessage("Low stock threshold is required").bail()
    .isInt({ min: 2, max: 20 })
    .withMessage("Low stock threshold must be a whole number between 2 and 20"),

  handleValidation,
];

export {
  ValidateSku,
  ValidateProduct,
  ValidateProductUpdate,
  ValidataionListquery,
};