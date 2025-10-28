// routes/studentstatus.js
import express from "express";
import db from "../models/db.js";

const router = express.Router();

router.get("/student_status", async (req, res) => {
  const { LRN } = req.query;
  console.log("🔍 Received LRN:", LRN);

  if (!LRN) {
    return res.status(400).json({ error: "Missing student ID" });
  }

  try {
    const [rows] = await db.query(
      "SELECT enrollment_status FROM student_details WHERE LRN = ?",
      [LRN]
    );
    console.log("✅ Query result:", rows);

    if (rows.length === 0) {
      return res.status(404).json({ error: "Student not found" });
    }

    res.json({ enrollment_status: rows[0].enrollment_status });
  } catch (err) {
    console.error("❌ DB Error:", err.message);
    res.status(500).json({ error: "Database error", details: err.message });
  }
});


export default router;
