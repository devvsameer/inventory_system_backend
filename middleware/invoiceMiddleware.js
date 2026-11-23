import { body, query, param, validationResult } from "express-validator";

const PAYMENT_METHODS = ["CASH", "UPI", "CARD"];
const MAX_QTY_PER_LINE = 1000;

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Two lines for the same SKU become one line with the quantities added.
const mergeDuplicateItems = (req, res, next) => {
  const merged = new Map();
  for (const { sku, quantity } of req.body.items) {
    merged.set(sku, (merged.get(sku) || 0) + quantity);
  }
  for (const [sku, quantity] of merged) {
    if (quantity > MAX_QTY_PER_LINE) {
      return res.status(400).json({
        errors: [{ path: "items", msg: `Total quantity for ${sku} can't exceed ${MAX_QTY_PER_LINE}` }],
      });
    }
  }
  req.body.items = [...merged].map(([sku, quantity]) => ({ sku, quantity }));
  next();
};

const ValidateInvoice = [
  body("items")
    .isArray({ min: 1, max: 50 })
    .withMessage("items must be a list of 1 to 50 products"),
  body("items.*.sku")
    .isString().withMessage("SKU must be a string").bail()
    .trim()
    .toUpperCase()
    .matches(/^[A-Z0-9_-]+$/)
    .withMessage("SKU can only contain letters, numbers, hyphens and underscores"),
  body("items.*.quantity")
    .isInt({ min: 1, max: MAX_QTY_PER_LINE })
    .withMessage(`Quantity must be a whole number between 1 and ${MAX_QTY_PER_LINE}`)
    .toInt(),
  body("payment_method")
    .isString().withMessage("Payment method is required").bail()
    .trim()
    .toUpperCase()
    .isIn(PAYMENT_METHODS)
    .withMessage("Payment method must be CASH, UPI or CARD"),
  handleValidation,
  mergeDuplicateItems,
];

const ValidateInvoiceList = [
  query("page").optional().isInt({ min: 1 }).withMessage("Page must be 1 or more"),
  query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("Limit must be between 1 and 100"),
  query("search").optional().isString().trim().isLength({ min: 1, max: 50 })
    .withMessage("Search must be 1 to 50 characters"),
  query("from").optional().isISO8601().withMessage("from must be a date like 2026-11-24"),
  query("to").optional().isISO8601().withMessage("to must be a date like 2026-11-24"),
  handleValidation,
];

const ValidateInvoiceNumber = [
  param("number")
    .trim()
    .toUpperCase()
    .matches(/^INV-\d{4}-\d{6,}$/)
    .withMessage("Invalid invoice number"),
  handleValidation,
];

export { ValidateInvoice, ValidateInvoiceList, ValidateInvoiceNumber };
