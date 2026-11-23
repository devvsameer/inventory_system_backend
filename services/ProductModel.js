import pool from "../config/db.js";

export const findBySku = async (sku) => {
  const { rows } = await pool.query("SELECT * FROM products WHERE sku = $1", [sku]);
  return rows[0] ?? null;
};