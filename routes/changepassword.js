// routes/changepassword.js
import express from "express";
import db from "../models/db.js";

const router = express.Router();

router.post("/change-password", async (req, res) => {
  const { email, currentPassword, newPassword } = req.body;

  if (!email || !currentPassword || !newPassword) {
    return res.status(400).json({ success: false, message: "All fields are required" });
  }

  try {
    // ✅ Verify that the email exists and password matches
    const [user] = await db
      .promise()
      .query("SELECT * FROM student_accounts WHERE email = ? AND password = ?", [
        email,
        currentPassword,
      ]);

    if (user.length === 0) {
      return res.status(404).json({ success: false, message: "Email not found or password incorrect" });
    }

    // ✅ Update password
    await db
      .promise()
      .query("UPDATE student_accounts SET password = ? WHERE email = ?", [
        newPassword,
        email,
      ]);

    res.json({ success: true, message: "Password changed successfully" });
  } catch (error) {
    console.error("Error changing password:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

export default router;
