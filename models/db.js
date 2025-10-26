// models/db.js
import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

// ✅ Create a connection pool (no db.connect!)
const db = mysql.createPool({
  host: process.env.DB_HOST,        // e.g. "srv123.hostinger.com"
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// ✅ Optional: test the connection once
try {
  const [rows] = await db.query("SELECT 1");
  console.log("✅ Successfully connected to ONLINE Hostinger MySQL!");
} catch (err) {
  console.error("❌ MySQL connection failed:", err);
}

export default db;
