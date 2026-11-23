import pool from "../config/db.js";
import { findBySku } from "../services/ProductModel.js";

const getProductBySku = async (req, res) => {
  try {
    const product = await findBySku(req.params.sku);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    return res.status(200).json(product);
  } catch (err) {
    console.error("Error fetching product:", err);
    return res.status(500).json({ message: "Error fetching product" });
  }
};

const getProducts = async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
  const offset = (page - 1) * limit;
  const search = (req.query.search || "").trim();

  let whereClause = "";
  const filterParams = [];

  if (search) {
    filterParams.push(`%${search}%`);
    whereClause = "WHERE sku ILIKE $1 OR name ILIKE $1";
  }

  try {
    const countResult = await pool.query(
      `SELECT COUNT(*) AS total FROM products ${whereClause}`,
      filterParams
    );
    const totalProducts = Number(countResult.rows[0].total);
    const totalPages = Math.ceil(totalProducts / limit);

    const n = filterParams.length;
    const result = await pool.query(
      `SELECT * FROM products
       ${whereClause}
       ORDER BY id ASC
       LIMIT $${n + 1} OFFSET $${n + 2}`,
      [...filterParams, limit, offset]
    );

    return res.status(200).json({
      message: "Data retrieved successfully",
      rows: result.rows,
      pagination: {
        page,
        limit,
        totalProducts,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (err) {
    console.error("Error retrieving products:", err);
    return res.status(500).json({ message: "Failed to retrieve products" });
  }
};

const createProduct = async (req, res) => {
  const { sku, name, price, stock, low_stock_threshold } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO products (sku, name, price, stock, low_stock_threshold)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [sku, name, price, stock ?? 0, low_stock_threshold ?? 5]
    );
    return res.status(201).json({
      message: "Product created successfully",
      productId: result.rows[0].id,
    });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ message: "SKU already exists" });
    }
    console.error("Error creating product:", err);
    return res.status(500).json({ message: "Error creating product" });
  }
};

const updateProduct = async (req, res) => {
  const { sku } = req.params;
  const { name, price, stock, low_stock_threshold } = req.body;
  try {
    const result = await pool.query(
      `UPDATE products
       SET name = $1, price = $2, stock = $3, low_stock_threshold = $4
       WHERE sku = $5`,
      [name, price, stock, low_stock_threshold, sku]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Product not found" });
    }
    return res.status(200).json({ message: "Product updated successfully" });
  } catch (err) {
    console.error("Error updating product:", err);
    return res.status(500).json({ message: "Error updating product" });
  }
};

const deleteProduct = async (req, res) => {
  const { sku } = req.params;
  try {
    const result = await pool.query("DELETE FROM products WHERE sku = $1", [sku]);
    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Product not found" });
    }
    return res.status(200).json({ message: "Product deleted successfully" });
  } catch (err) {
    if (err.code === "23503") {
      return res.status(409).json({
        message: "This product appears on invoices and can't be deleted",
      });
    }
    console.error("Error deleting product:", err);
    return res.status(500).json({ message: "Error deleting product" });
  }
};

const getAllLowStockProducts = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM products WHERE stock <= low_stock_threshold ORDER BY stock ASC, id ASC"
    );
    return res.status(200).json(result.rows);
  } catch (err) {
    console.error("Error fetching low stock products:", err);
    return res.status(500).json({ message: "Error fetching low stock products" });
  }
};

export {
  getProductBySku,
  createProduct,
  updateProduct,
  deleteProduct,
  getAllLowStockProducts,
  getProducts,
};