// routes/login.js
import express from "express";
import bcrypt from "bcrypt";
import db from "../models/db.js";

const router = express.Router();

router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: "Please enter both email and password.",
    });
  }

  try {
    const [rows] = await db.query(
      `SELECT sd.STD_ID, sd.email, sa.password
       FROM student_details sd
       INNER JOIN student_accounts sa ON sd.STD_ID = sa.STD_ID
       WHERE sd.email = ?
       LIMIT 1`,
      [email]
    );

    if (rows.length === 0) {
      return res.json({ success: false, message: "Invalid email or password." });
    }

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password);

    if (match) {
      delete user.password;
      return res.json({ success: true, user });
    } else {
      return res.json({ success: false, message: "Invalid email or password." });
    }
  } catch (err) {
    console.error("❌ Login DB Error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;
