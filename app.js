import express from "express";
import pool from "./config/db.js";
import productRoutes from "./routes/productRoutes.js";
import cors from "cors"
const app = express();


//middlewares
const allowed = [
  'https://inventory-app-tau-ten.vercel.app',
  'http://localhost:5173',
];

app.use(cors({
  origin: allowed,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
}));
app.use(express.json());
app.use("/products", productRoutes);




const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

let count = 0;

while (true) {
  try {
    const connection = await pool.getConnection();
    console.log("Connected to the database");
    connection.release();
    break;
  } catch (err) {
    count++;
    console.error(`Connection attempt ${count} failed:`, err);
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