// server.js
import express from "express";
import cors from "cors";

import bodyParser from "body-parser";
import loginRoute from "./routes/login.js";
import studentStatusRoute from "./routes/studentstatus.js";
import studentProfileRoute from "./routes/studentprofile.js";
import announcementsRoute from "./routes/announcements.js";

const app = express();
const PORT = process.env.PORT || 1000;

// === Middleware ===
app.use(cors());
app.use(bodyParser.json());

// === Routes ===
app.use("/api", loginRoute);
app.use("/api", studentStatusRoute);
app.use("/api", studentProfileRoute);
app.use("/api", announcementsRoute);

// === Start Server ===
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});



