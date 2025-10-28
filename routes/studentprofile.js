import express from "express";
import db from "../models/db.js";

const router = express.Router();

// === GET student profile ===
router.get("/student-profile", async (req, res) => {
  const { LRN } = req.query;

  if (!LRN) {
    return res.status(400).json({ success: false, message: "Missing student LRN" });
  }

  try {
    const [rows] = await db.query(
      `SELECT 
         LRN,
         firstname,
         lastname,
         middlename,
         suffix,
         email,
         strand,
         yearlevel
       FROM student_details
       WHERE LRN = ?`,
      [LRN]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Student not found" });
    }

    res.json({ success: true, student: rows[0] });
  } catch (err) {
    console.error("DB Error:", err.message);
    res.status(500).json({ success: false, message: "Database error", details: err.message });
  }
});


// === PUT update student profile ===
router.put("/update-student-profile", async (req, res) => {
  const { LRN, firstname, middlename, lastname, suffix, email, strand, yearlevel } = req.body;

  if (!LRN) {
    return res.status(400).json({ success: false, message: "Missing student ID" });
  }

  try {
    const [result] = await db.query(
      `UPDATE student_details
       SET firstname = ?, middlename = ?, lastname = ?, suffix = ?, email = ?, strand = ?, yearlevel = ?
       WHERE LRN = ?`,
      [firstname, middlename, lastname, suffix, email, strand, yearlevel, LRN]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Student not found or no changes made." });
    }

    res.json({ success: true, message: "Profile updated successfully." });
  } catch (err) {
    console.error("Update Error:", err.message);
    res.status(500).json({ success: false, message: "Database error", details: err.message });
  }
});

export default router;
