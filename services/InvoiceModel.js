import pool from "../config/db.js";

const TAX_RATE = 18; // flat GST percent, added on top of prices

class HttpError extends Error {
  constructor(status, body) {
    super(body.message);
    this.status = status;
    this.body = body;
  }
}

// Money is calculated in whole paise (integers), never floating point.
const toPaise = (value) => {
  const [whole, frac = ""] = String(value).split(".");
  return Number(whole) * 100 + Number((frac + "00").slice(0, 2));
};
const fromPaise = (paise) => (paise / 100).toFixed(2);

export async function createInvoice(items, paymentMethod) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Lock the product rows (sorted by id so two checkouts can't deadlock).
    const skus = items.map((i) => i.sku);
    const { rows: products } = await client.query(
      `SELECT id, sku, name, price, stock
       FROM products
       WHERE sku = ANY($1::text[])
       ORDER BY id
       FOR UPDATE`,
      [skus]
    );
    const bySku = new Map(products.map((p) => [p.sku, p]));

    // 2. Every SKU must exist.
    const missing = skus.filter((s) => !bySku.has(s));
    if (missing.length) {
      throw new HttpError(404, { message: "Some products were not found", missing });
    }

    // 3. Every line must have enough stock (report all shortages at once).
    const shortages = items
      .filter((i) => bySku.get(i.sku).stock < i.quantity)
      .map((i) => ({
        sku: i.sku,
        name: bySku.get(i.sku).name,
        requested: i.quantity,
        available: bySku.get(i.sku).stock,
      }));
    if (shortages.length) {
      throw new HttpError(409, { message: "Not enough stock", shortages });
    }

    // 4. Totals, from database prices only.
    const lines = items.map((i) => {
      const product = bySku.get(i.sku);
      const unit = toPaise(product.price);
      return { product, quantity: i.quantity, unit, line: unit * i.quantity };
    });
    const subtotal = lines.reduce((sum, l) => sum + l.line, 0);
    const tax = Math.floor((subtotal * TAX_RATE + 50) / 100); // rounded once
    const total = subtotal + tax;

    // 5. Invoice row, then its number from the new id.
    const inserted = await client.query(
      `INSERT INTO invoices (subtotal, tax_rate, tax_amount, total, payment_method)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, created_at`,
      [fromPaise(subtotal), TAX_RATE.toFixed(2), fromPaise(tax), fromPaise(total), paymentMethod]
    );
    const { id, created_at } = inserted.rows[0];
    const invoiceNumber = `INV-${created_at.getFullYear()}-${String(id).padStart(6, "0")}`;
    await client.query("UPDATE invoices SET invoice_number = $1 WHERE id = $2", [
      invoiceNumber,
      id,
    ]);

    // 6. Items (with snapshots) and stock reduction.
    for (const l of lines) {
      await client.query(
        `INSERT INTO invoice_items
           (invoice_id, product_id, sku, product_name, unit_price, quantity, line_total)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [id, l.product.id, l.product.sku, l.product.name, fromPaise(l.unit), l.quantity, fromPaise(l.line)]
      );
      const updated = await client.query(
        "UPDATE products SET stock = stock - $1 WHERE id = $2 AND stock >= $1",
        [l.quantity, l.product.id]
      );
      if (updated.rowCount !== 1) {
        throw new HttpError(409, { message: "Not enough stock" });
      }
    }

    await client.query("COMMIT");

    return {
      invoice_number: invoiceNumber,
      created_at,
      payment_method: paymentMethod,
      subtotal: fromPaise(subtotal),
      tax_rate: TAX_RATE.toFixed(2),
      tax_amount: fromPaise(tax),
      total: fromPaise(total),
      items: lines.map((l) => ({
        sku: l.product.sku,
        product_name: l.product.name,
        unit_price: fromPaise(l.unit),
        quantity: l.quantity,
        line_total: fromPaise(l.line),
      })),
    };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function listInvoices({ page, limit, search, from, to }) {
  const conditions = [];
  const params = [];
  if (search) {
    params.push(`%${search}%`);
    conditions.push(`invoice_number ILIKE $${params.length}`);
  }
  if (from) {
    params.push(from);
    conditions.push(`created_at >= $${params.length}::date`);
  }
  if (to) {
    params.push(to);
    conditions.push(`created_at < ($${params.length}::date + 1)`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const count = await pool.query(`SELECT COUNT(*) AS total FROM invoices ${where}`, params);
  const total = Number(count.rows[0].total);

  const n = params.length;
  const { rows } = await pool.query(
    `SELECT i.id, i.invoice_number, i.created_at, i.payment_method,
            i.subtotal, i.tax_amount, i.total,
            (SELECT COUNT(*) FROM invoice_items ii WHERE ii.invoice_id = i.id)::int AS items_count
     FROM invoices i
     ${where}
     ORDER BY i.created_at DESC, i.id DESC
     LIMIT $${n + 1} OFFSET $${n + 2}`,
    [...params, limit, (page - 1) * limit]
  );
  return { rows, total };
}

export async function findInvoiceByNumber(number) {
  const invoice = await pool.query(
    `SELECT id, invoice_number, created_at, payment_method,
            subtotal, tax_rate, tax_amount, total
     FROM invoices WHERE invoice_number = $1`,
    [number]
  );
  if (invoice.rows.length === 0) return null;

  const items = await pool.query(
    `SELECT sku, product_name, unit_price, quantity, line_total
     FROM invoice_items WHERE invoice_id = $1 ORDER BY id`,
    [invoice.rows[0].id]
  );
  return { ...invoice.rows[0], items: items.rows };
}
