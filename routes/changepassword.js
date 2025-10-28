// routes/changepassword.js
import express from "express";
import db from "../models/db.js";
import bcrypt from "bcrypt";

const router = express.Router();

router.post("/change-password", async (req, res) => {
  const { LRN, currentPassword, newPassword } = req.body;

  if (!LRN || !currentPassword || !newPassword) {
    return res.status(400).json({ success: false, message: "All fields are required" });
  }

  try {
    // 1️⃣ Get student account by LRN
    const [rows] = await db.query("SELECT * FROM student_accounts WHERE LRN = ?", [LRN]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Student not found" });
    }

    const student = rows[0];

    // 2️⃣ Compare current password
    const passwordMatch = await bcrypt.compare(currentPassword, student.password);
    if (!passwordMatch) {
      return res.status(401).json({ success: false, message: "Current password incorrect" });
    }

    // 3️⃣ Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // 4️⃣ Update in DB
    await db.query("UPDATE student_accounts SET password = ? WHERE LRN = ?", [
      hashedPassword,
      LRN,
    ]);

    res.json({ success: true, message: "Password changed successfully" });
  } catch (error) {
    console.error("Error changing password:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

export default router;
