// models/db.js
import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

// ✅ Create a connection pool for PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // We will use the Supabase Connection String
  ssl: {
    rejectUnauthorized: false, // Required for Supabase/Render connections
  },
});

// ✅ Test the connection
(async () => {
  try {
    const client = await pool.connect();
    console.log("✅ Successfully connected to Supabase PostgreSQL!");
    client.release();
  } catch (err) {
    console.error("❌ Supabase connection failed:", err.message);
  }
})();

export default pool;
