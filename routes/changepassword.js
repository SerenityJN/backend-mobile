// routes/changepassword.js
import express from "express";
import db from "../models/db.js";
import bcrypt from "bcrypt";

const router = express.Router();

router.post("/change-password", async (req, res) => {
  const { email, currentPassword, newPassword } = req.body;

  try {
    // 1. Get user data with password hash
    const [rows] = await db.query(
      `SELECT sd.LRN, sd.email, sa.password 
       FROM student_details sd 
       INNER JOIN student_accounts sa ON sd.LRN = sa.LRN 
       WHERE sd.email = ?`,
      [email]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const user = rows[0];

    // 2. Verify current password (compare with hash)
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    
    if (!isCurrentPasswordValid) {
      return res.status(401).json({ success: false, message: "Current password is incorrect" });
    }

    // 3. Hash the new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 12);

    // 4. Update password in database
    await db.query(
      `UPDATE student_accounts SET password = ? WHERE LRN = ?`,
      [hashedNewPassword, user.LRN]
    );

    console.log("✅ Password changed for:", email);

    res.json({
      success: true,
      message: "Password changed successfully"
    });

  } catch (error) {
    console.error("❌ Change password error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to change password" 
    });
  }
});

export default router;
