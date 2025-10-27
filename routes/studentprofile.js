// routes/studentprofile.js
import express from "express";
import db from "../models/db.js";

const router = express.Router();

router.get("/student-profile", async (req, res) => {
  const { STD_ID } = req.query;

  if (!STD_ID) {
    return res.status(400).json({ success: false, message: "Missing student ID" });
  }

  try {
    const [rows] = await db.query(
      `SELECT 
         STD_ID,
         firstname,
         lastname,
         middlename,
         suffix,
         email,
         strand,
         yearlevel
       FROM student_details
       WHERE STD_ID = ?`,
      [STD_ID]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Student not found" });
    }

    // ✅ Return the data as-is (your React code already expects .student)
    res.json({ success: true, student: rows[0] });
  } catch (err) {
    console.error("DB Error:", err.message);
    res.status(500).json({ success: false, message: "Database error", details: err.message });
  }
});

export default router;
