import express from "express";
import db from "../models/db.js";

const router = express.Router();

// GET Enrollment Status by Track Code
router.get("/:track_code", async (req, res) => {
  const { track_code } = req.params;

  try {
    const [rows] = await db.query(
      `SELECT sd.enrollment_status 
       FROM student_accounts sa
       JOIN student_details sd ON sa.LRN = sd.LRN
       WHERE sa.track_code = ?`,
      [track_code]
    );

    if (rows.length === 0) {
      return res.json({ success: false, message: "Track Code Not Found" });
    }

    return res.json({
      success: true,
      enrollment_status: rows[0].enrollment_status,
    });
  } catch (err) {
    console.error(err);
    return res.json({ success: false, message: "Server Error" });
  }
});

export default router;
