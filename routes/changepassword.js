// routes/changepassword.js
import express from "express";
import db from "../models/db.js"; // your db connection file

const router = express.Router();

router.post("/change-password", async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ success: false, message: "All fields are required" });
  }

  try {
    // Example: Replace this with your actual user logic
    const [user] = await db.promise().query(
      "SELECT * FROM students WHERE password = ?",
      [currentPassword]
    );

    if (user.length === 0) {
      return res.status(401).json({ success: false, message: "Current password incorrect" });
    }

    await db.promise().query(
      "UPDATE students SET password = ? WHERE id = ?",
      [newPassword, user[0].id]
    );

    res.json({ success: true, message: "Password changed successfully" });
  } catch (error) {
    console.error("Error changing password:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

export default router;
