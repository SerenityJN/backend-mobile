import express from "express";
import bcrypt from "bcrypt";
import db from "../models/db.js";

const router = express.Router();

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  console.log("🔹 Login attempt:", email);

  if (!email || !password) {
    console.log("⚠️ Missing email or password");
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

    console.log("🔹 Query result:", rows);

    if (rows.length === 0) {
      console.log("⚠️ No user found for:", email);
      return res.json({ success: false, message: "Invalid email or password." });
    }

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password);
    console.log("🔹 Password match:", match);

    if (match) {
      delete user.password;
      console.log("✅ Login success for:", email);
      return res.json({ success: true, user });
    } else {
      console.log("❌ Invalid password for:", email);
      return res.json({ success: false, message: "Invalid email or password." });
    }
  } catch (err) {
    console.error("❌ Login DB Error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
