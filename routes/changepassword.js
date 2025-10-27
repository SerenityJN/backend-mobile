import express from "express";
import db from "../models/db.js";

const router = express.Router();

router.post("/change-password", async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ success: false, message: "All fields are required" });
  }

  try {
    // Find user by current password (this is just for demo, normally use user ID or email)
    const [rows] = await db.promise().query(
      "SELECT * FROM student_accounts WHERE password = ?",
      [currentPassword]
    );

    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: "Current password incorrect" });
    }

    // Update the password
    await db.promise().query(
      "UPDATE student_accounts SET password = ? WHERE id = ?",
      [newPassword, rows[0].id]
    );

    res.json({ success: true, message: "Password changed successfully" });
  } catch (error) {
    console.error("Error changing password:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

export default router;
