import express from "express";
import db from "../models/db.js";
import jwt from "jsonwebtoken";
import { Resend } from "resend";
import bcrypt from "bcryptjs";

const router = express.Router();

// Initialize Resend with error handling
let resend;
try {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not configured");
  }
  resend = new Resend(process.env.RESEND_API_KEY);
} catch (error) {
  console.error("❌ Resend initialization failed:", error.message);
}

// Check for JWT secret on startup
if (!process.env.JWT_SECRET) {
  console.warn("⚠️  JWT_SECRET is not set. Using fallback for development only.");
}

// Store OTPs temporarily (in production, use Redis)
const otpStore = new Map();

// Rate limiting store
const rateLimitStore = new Map();

// Generate random OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
};

// Rate limiting function
const checkRateLimit = (identifier, limit = 5, windowMs = 15 * 60 * 1000) => {
  const now = Date.now();
  const windowStart = now - windowMs;

  if (!rateLimitStore.has(identifier)) {
    rateLimitStore.set(identifier, []);
  }

  const requests = rateLimitStore.get(identifier).filter(time => time > windowStart);
  rateLimitStore.set(identifier, requests);

  if (requests.length >= limit) {
    return false;
  }

  requests.push(now);
  return true;
};

// Clean up expired OTPs and rate limits periodically
setInterval(() => {
  const now = Date.now();
  
  // Clean OTP store
  for (const [email, data] of otpStore.entries()) {
    if (now > data.expiresAt) {
      otpStore.delete(email);
      console.log(`🧹 Cleaned expired OTP for: ${email}`);
    }
  }
  
  // Clean rate limit store (keep only last 24 hours)
  for (const [key, timestamps] of rateLimitStore.entries()) {
    const recentTimestamps = timestamps.filter(time => now - time < 24 * 60 * 60 * 1000);
    if (recentTimestamps.length === 0) {
      rateLimitStore.delete(key);
    } else {
      rateLimitStore.set(key, recentTimestamps);
    }
  }
}, 5 * 60 * 1000); // Run every 5 minutes

// Password Login Endpoint
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: "Please enter both email and password.",
    });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      message: "Please enter a valid email address.",
    });
  }

  // Rate limiting for login attempts
  if (!checkRateLimit(`login:${email}`, 5, 15 * 60 * 1000)) {
    return res.status(429).json({
      success: false,
      message: "Too many login attempts. Please try again later or use OTP login."
    });
  }

  console.log("🔹 Password login attempt for:", email);

  try {
    // Check if user exists and verify password
    const [rows] = await db.query(
      `SELECT 
        sd.LRN, 
        sd.email, 
        sd.firstname, 
        sd.lastname,
        sa.password
      FROM student_details sd 
      INNER JOIN student_accounts sa ON sd.LRN = sa.LRN
      WHERE sd.email = ? 
      LIMIT 1`,
      [email]
    );

    if (rows.length === 0) {
      console.log("⚠️ Login failed - email not found:", email);
      return res.status(404).json({ 
        success: false, 
        message: "Invalid email or password." 
      });
    }

    const user = rows[0];

    // Check if password field exists
    if (!user.password) {
      console.log("⚠️ No password set for user:", email);
      return res.status(401).json({ 
        success: false, 
        message: "Password login not available. Please use OTP login." 
      });
    }

    // Verify password - using bcrypt for security
    let isPasswordValid = false;
    try {
      // Check if password is hashed (starts with $2b$)
      if (user.password.startsWith('$2b$')) {
        isPasswordValid = await bcrypt.compare(password, user.password);
      } else {
        // Fallback for plain text passwords (migrate to bcrypt in production)
        isPasswordValid = password === user.password;
        
        // Optional: Auto-upgrade to hashed password
        if (isPasswordValid && process.env.AUTO_HASH_PASSWORDS === 'true') {
          const hashedPassword = await bcrypt.hash(password, 12);
          await db.query(
            `UPDATE student_details SET password = ? WHERE email = ?`,
            [hashedPassword, email]
          );
          console.log("🔒 Auto-upgraded password to hash for:", email);
        }
      }
    } catch (hashError) {
      console.error("Password verification error:", hashError);
      isPasswordValid = password === user.password; // Fallback
    }

    if (!isPasswordValid) {
      console.log("⚠️ Invalid password for:", email);
      return res.status(401).json({ 
        success: false, 
        message: "Invalid email or password." 
      });
    }

    // Check if JWT secret is configured
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error("❌ JWT_SECRET is not configured");
      return res.status(500).json({ 
        success: false, 
        message: "Server configuration error." 
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.LRN,
        email: user.email,
        type: 'student'
      },
      jwtSecret,
      { expiresIn: '7d' }
    );

    console.log("✅ Password login successful for:", email);

    // Return user data (excluding password)
    res.json({
      success: true,
      message: "Login successful!",
      token: token,
      user: {
        LRN: user.LRN,
        email: user.email,
        firstname: user.firstname,
        lastname: user.lastname,
        first_name: user.firstname,
        last_name: user.lastname
      }
    });

  } catch (err) {
    console.error("❌ Login error:", err);
    return res.status(500).json({ 
      success: false, 
      message: "Login failed. Please try again." 
    });
  }
});

// Request OTP Endpoint
router.post("/request-otp", async (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({
      success: false,
      message: "Please enter your email address.",
    });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      message: "Please enter a valid email address.",
    });
  }

  // Rate limiting for OTP requests
  if (!checkRateLimit(`otp:${email}`, 3, 15 * 60 * 1000)) {
    return res.status(429).json({
      success: false,
      message: "Too many OTP requests. Please try again later."
    });
  }

  console.log("🔹 OTP request for:", email);

  try {
    // Check if email exists in database
    const [rows] = await db.query(
      `SELECT sd.LRN, sd.email, sd.firstname 
       FROM student_details sd 
       WHERE sd.email = ? 
       LIMIT 1`,
      [email]
    );

    if (rows.length === 0) {
      console.log("⚠️ Email not found:", email);
      return res.status(404).json({ 
        success: false, 
        message: "Email not found in our system." 
      });
    }

    const user = rows[0];
    const otp = generateOTP();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Store OTP with expiration
    otpStore.set(email, {
      otp,
      expiresAt,
      attempts: 0,
      createdAt: Date.now()
    });

    // Check if Resend is configured
    if (!resend) {
      console.log("📧 Resend not configured - OTP would be:", otp);
      return res.json({ 
        success: true, 
        message: "OTP generated (email service not configured)",
        debug_otp: process.env.NODE_ENV === 'development' ? otp : undefined
      });
    }

    // Send OTP via Resend
    const fromAddress = process.env.EMAIL_FROM || 'Southville 8B SHS <onboarding@resend.dev>';
    
    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to: [email],
      subject: 'Your Login OTP - Southville 8B Senior High School',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { color: #353d90; text-align: center; border-bottom: 3px solid #f6a800; padding-bottom: 10px; }
                .otp-code { background: #f6a800; color: white; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 8px; margin: 30px 0; border-radius: 10px; }
                .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px; text-align: center; }
                .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 10px; border-radius: 5px; margin: 15px 0; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>Southville 8B Senior High School</h1>
            </div>
            
            <p>Hello <strong>${user.firstname}</strong>,</p>
            
            <p>Your One-Time Password (OTP) for login is:</p>
            
            <div class="otp-code">${otp}</div>
            
            <div class="warning">
                <strong>⚠️ Important:</strong> This OTP will expire in 10 minutes. Do not share this code with anyone.
            </div>
            
            <p>If you didn't request this login, please ignore this email.</p>
            
            <div class="footer">
                <p>© 2025 Southville 8B Senior High School. All rights reserved.</p>
            </div>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error("❌ Resend error:", error);
      if (process.env.NODE_ENV === 'development') {
        return res.status(500).json({ 
          success: false, 
          message: `Failed to send OTP email. Debug: ${otp}` 
        });
      }
      return res.status(500).json({ 
        success: false, 
        message: "Failed to send OTP email. Please try again." 
      });
    }

    console.log("✅ OTP sent via Resend. Email ID:", data?.id);

    res.json({ 
      success: true, 
      message: "OTP sent to your email address." 
    });

  } catch (err) {
    console.error("❌ OTP request error:", err);
    return res.status(500).json({ 
      success: false, 
      message: "Failed to process OTP request. Please try again." 
    });
  }
});

// Verify OTP and Issue Token
router.post("/verify-otp", async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({
      success: false,
      message: "Please enter both email and OTP.",
    });
  }

  // Validate OTP format
  if (!/^\d{6}$/.test(otp)) {
    return res.status(400).json({
      success: false,
      message: "OTP must be a 6-digit number.",
    });
  }

  // Rate limiting for OTP verification attempts
  if (!checkRateLimit(`verify:${email}`, 10, 15 * 60 * 1000)) {
    return res.status(429).json({
      success: false,
      message: "Too many verification attempts. Please request a new OTP."
    });
  }

  console.log("🔹 OTP verification for:", email);

  try {
    const storedData = otpStore.get(email);

    // Check if OTP exists
    if (!storedData) {
      return res.status(404).json({ 
        success: false, 
        message: "OTP not found or expired. Please request a new OTP." 
      });
    }

    // Check if OTP is expired
    if (Date.now() > storedData.expiresAt) {
      otpStore.delete(email);
      return res.status(410).json({ 
        success: false, 
        message: "OTP has expired. Please request a new OTP." 
      });
    }

    // Check if OTP matches
    if (storedData.otp !== otp) {
      storedData.attempts += 1;
      
      // Limit OTP attempts
      if (storedData.attempts >= 5) {
        otpStore.delete(email);
        return res.status(429).json({ 
          success: false, 
          message: "Too many failed attempts. Please request a new OTP." 
        });
      }

      const remainingAttempts = 5 - storedData.attempts;
      return res.status(401).json({ 
        success: false, 
        message: `Invalid OTP. ${remainingAttempts} attempts remaining.` 
      });
    }

    // OTP is valid - get user data
    const [rows] = await db.query(
      `SELECT sd.LRN, sd.email, sd.firstname, sd.lastname
       FROM student_details sd 
       WHERE sd.email = ? 
       LIMIT 1`,
      [email]
    );

    if (rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: "User not found." 
      });
    }

    const user = rows[0];

    // Check if JWT secret is configured
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error("❌ JWT_SECRET is not configured");
      return res.status(500).json({ 
        success: false, 
        message: "Server configuration error." 
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.LRN,
        email: user.email,
        type: 'student'
      },
      jwtSecret,
      { expiresIn: '7d' }
    );

    // Clean up used OTP
    otpStore.delete(email);

    console.log("✅ OTP verification successful for:", email);

    res.json({
      success: true,
      message: "Login successful!",
      token: token,
      user: {
        LRN: user.LRN,
        email: user.email,
        firstname: user.firstname,
        lastname: user.lastname,
        first_name: user.firstname,
        last_name: user.lastname
      }
    });

  } catch (err) {
    console.error("❌ OTP verification error:", err);
    return res.status(500).json({ 
      success: false, 
      message: "Verification failed. Please try again." 
    });
  }
});

// Resend OTP Endpoint
router.post("/resend-otp", async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      success: false,
      message: "Email address is required.",
    });
  }

  // Rate limiting for OTP resend
  if (!checkRateLimit(`resend:${email}`, 2, 15 * 60 * 1000)) {
    return res.status(429).json({
      success: false,
      message: "Too many resend requests. Please try again later."
    });
  }

  console.log("🔹 Resend OTP request for:", email);

  try {
    // Check if email exists in database
    const [rows] = await db.query(
      `SELECT sd.LRN, sd.email, sd.firstname 
       FROM student_details sd 
       WHERE sd.email = ? 
       LIMIT 1`,
      [email]
    );

    if (rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: "Email not found in our system." 
      });
    }

    const user = rows[0];
    const otp = generateOTP();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Store new OTP with expiration
    otpStore.set(email, {
      otp,
      expiresAt,
      attempts: 0,
      createdAt: Date.now()
    });

    // Check if Resend is configured
    if (!resend) {
      console.log("📧 Resend not configured - New OTP would be:", otp);
      return res.json({ 
        success: true, 
        message: "New OTP generated (email service not configured)",
        debug_otp: process.env.NODE_ENV === 'development' ? otp : undefined
      });
    }

    // Send new OTP via Resend
    const fromAddress = process.env.EMAIL_FROM || 'Southville 8B SHS <onboarding@resend.dev>';
    
    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to: [email],
      subject: 'Your New Login OTP - Southville 8B Senior High School',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { color: #353d90; text-align: center; border-bottom: 3px solid #f6a800; padding-bottom: 10px; }
                .otp-code { background: #f6a800; color: white; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 8px; margin: 30px 0; border-radius: 10px; }
                .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px; text-align: center; }
                .info { background: #d1ecf1; border: 1px solid #bee5eb; padding: 10px; border-radius: 5px; margin: 15px 0; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>Southville 8B Senior High School</h1>
            </div>
            
            <p>Hello <strong>${user.firstname}</strong>,</p>
            
            <div class="info">
                <strong>📧 New OTP Requested:</strong> You requested a new verification code.
            </div>
            
            <p>Your new One-Time Password (OTP) for login is:</p>
            
            <div class="otp-code">${otp}</div>
            
            <p>This OTP will expire in 10 minutes.</p>
            
            <p>If you didn't request this, please secure your account.</p>
            
            <div class="footer">
                <p>© 2025 Southville 8B Senior High School. All rights reserved.</p>
            </div>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error("❌ Resend error:", error);
      return res.status(500).json({ 
        success: false, 
        message: "Failed to resend OTP. Please try again." 
      });
    }

    console.log("✅ New OTP sent via Resend. Email ID:", data?.id);

    res.json({ 
      success: true, 
      message: "New OTP sent to your email address." 
    });

  } catch (err) {
    console.error("❌ Resend OTP error:", err);
    return res.status(500).json({ 
      success: false, 
      message: "Failed to resend OTP. Please try again." 
    });
  }
});

// Health check endpoint
router.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "Auth service is running",
    timestamp: new Date().toISOString(),
    otpStoreSize: otpStore.size,
    rateLimitStoreSize: rateLimitStore.size
  });
});

// Authentication middleware
export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: "Access token required." 
    });
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    console.error("❌ JWT_SECRET is not configured in authenticateToken");
    return res.status(500).json({ 
      success: false, 
      message: "Server configuration error." 
    });
  }

  jwt.verify(token, jwtSecret, (err, user) => {
    if (err) {
      return res.status(403).json({ 
        success: false, 
        message: "Invalid or expired token." 
      });
    }
    req.user = user;
    next();
  });
};

export default router;