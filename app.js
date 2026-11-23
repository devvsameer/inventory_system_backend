import express from "express";
import pool from "./config/db.js";
import productRoutes from "./routes/productRoutes.js";
import invoiceRoutes from "./routes/invoiceRoutes.js";
import cors from "cors"
const app = express();


//middlewares
const allowedOrigins = [
  "https://inventory-app-tau-ten.vercel.app",
  "http://localhost:5173",
];

app.use(
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);
app.use(express.json());
app.use("/products", productRoutes);
app.use("/invoices", invoiceRoutes);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let count = 0;

while (true) {
  try {
    const client = await pool.connect();
    console.log("Connected to the database");
    client.release();
    break;
  } catch (err) {
    count++;
    console.error(`Connection attempt ${count} failed:`, err.message);
    await sleep(3000);
  }
}
// app.get("/", async (req, res) => {
//   // res.send("Hello World!");
//   let query = await pool.query("SELECT * FROM products");
//   // res.json(query[0]);
//   let items = query[0].map((item) => {
//     return {
//       id: item.id,
//       name: item.name,
//       price: item.price,
//     };
//   });
//   res.json(items);

// });


export default app;
