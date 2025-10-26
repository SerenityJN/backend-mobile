// backend/db.js - FINAL VERSION for PC -> Online DB connection

import mysql from "mysql2";
import dotenv from 'dotenv';

dotenv.config();

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
});

db.connect((err) => {
  if (err) {
    console.error("❌ ONLINE DB connection failed:", err);
  } else {
    console.log("✅ Successfully connected to ONLINE Hostinger MySQL from PC!");
  }
});

export default db;