// server.js
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import fileUpload from "express-fileupload"; // ADD THIS
import loginRoute from "./routes/AuthLogin.js";
import enrollmentRouter from "./routes/enrollmentRoute.js";
import studentStatusRoute from "./routes/studentstatus.js";
import studentProfileRoute from "./routes/studentprofile.js";
import changePasswordRoute from "./routes/changepassword.js";
import uploadRoute from "./routes/uploadRoutes.js";

const app = express();
const PORT = process.env.PORT || 1000;

// === Middleware ===
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true })); // ADD THIS

// ADD FILE UPLOAD MIDDLEWARE
app.use(fileUpload({
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  abortOnLimit: true,
  createParentPath: true
}));

// === Routes ===
app.use("/api", loginRoute);
app.use("/api/enrollment-status", enrollmentRouter);
app.use("/api", studentStatusRoute);
app.use("/api", studentProfileRoute);
app.use("/api", changePasswordRoute);
app.use("/api", uploadRoute);

// === Start Server ===
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});