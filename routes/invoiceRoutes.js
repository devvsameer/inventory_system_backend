import express from "express";
import {
  ValidateInvoice,
  ValidateInvoiceList,
  ValidateInvoiceNumber,
} from "../middleware/invoiceMiddleware.js";
import {
  postInvoice,
  getInvoices,
  getInvoiceByNumber,
} from "../controllers/invoiceController.js";

const router = express.Router();

router.post("/", ValidateInvoice, postInvoice);
router.get("/", ValidateInvoiceList, getInvoices);
router.get("/:number", ValidateInvoiceNumber, getInvoiceByNumber);

export default router;
