// routes/studentstatus.js
import express from "express";
import db from "../models/db.js";

const router = express.Router();

router.get("/student_status", async (req, res) => {
  const { STD_ID } = req.query;

  if (!STD_ID) {
    return res.status(400).json({ error: "Missing student ID" });
  }

  try {
    const [rows] = await db.query(
      "SELECT student_status FROM student_details WHERE STD_ID = ?",
      [STD_ID]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Student not found" });
    }

    res.json({ student_status: rows[0].student_status });
  } catch (err) {
    console.error("DB Error:", err.message);
    res.status(500).json({ error: "Database error", details: err.message });
  }
});

export default router;
