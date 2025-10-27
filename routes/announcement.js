// routes/announcements.js
import express from "express";
import db from "../models/db.js";
const router = express.Router();

// Example static or database-based response
router.post("/announcements", async (req, res) => {
  try {
    const announcements = [
      {
        id: 1,
        title: "Welcome Back!",
        date: "Oct 27, 2025",
        content: "The semester has officially started. Good luck, students!"
      },
      {
        id: 2,
        title: "Exam Week",
        date: "Nov 15, 2025",
        content: "Prepare early for the midterms next month."
      },
    ];

    res.json(announcements);
  } catch (err) {
    console.error("Error fetching announcements:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;

