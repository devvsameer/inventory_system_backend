import {
  createInvoice,
  listInvoices,
  findInvoiceByNumber,
} from "../services/InvoiceModel.js";

const postInvoice = async (req, res) => {
  try {
    const invoice = await createInvoice(req.body.items, req.body.payment_method);
    return res.status(201).json(invoice);
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json(err.body);
    }
    console.error("Error creating invoice:", err);
    return res.status(500).json({ message: "Error creating invoice" });
  }
};

const getInvoices = async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
  const search = (req.query.search || "").trim();
  const { from, to } = req.query;

  try {
    const { rows, total } = await listInvoices({ page, limit, search, from, to });
    const totalPages = Math.ceil(total / limit);
    return res.status(200).json({
      message: "Data retrieved successfully",
      rows,
      pagination: {
        page,
        limit,
        totalInvoices: total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (err) {
    console.error("Error listing invoices:", err);
    return res.status(500).json({ message: "Failed to retrieve invoices" });
  }
};

const getInvoiceByNumber = async (req, res) => {
  try {
    const invoice = await findInvoiceByNumber(req.params.number);
    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }
    return res.status(200).json(invoice);
  } catch (err) {
    console.error("Error fetching invoice:", err);
    return res.status(500).json({ message: "Error fetching invoice" });
  }
};

export { postInvoice, getInvoices, getInvoiceByNumber };
