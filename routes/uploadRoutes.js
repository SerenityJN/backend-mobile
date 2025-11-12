// routes/uploadRoutes.js
import express from "express";
import db from "../models/db.js";
import cloudinary from "../models/cloudinary.js";

const router = express.Router();

// === POST upload document to Cloudinary ===
router.post("/document", async (req, res) => {
  const { LRN, document_type, file_name, lastname } = req.body;

  if (!LRN || !document_type || !file_name || !last_name) {
    return res.status(400).json({ 
      success: false, 
      message: "Missing required fields: LRN, document_type, file_name, lastname" 
    });
  }

  if (!req.files || !req.files.document) {
    return res.status(400).json({ 
      success: false, 
      message: "No file uploaded" 
    });
  }

  try {
    const file = req.files.document;
    
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (!allowedTypes.includes(file.mimetype)) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid file type. Only JPG, PNG, and PDF are allowed." 
      });
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      return res.status(400).json({ 
        success: false, 
        message: "File size too large. Maximum size is 10MB." 
      });
    }

    // Create folder path
    const folderPath = `documents/${LRN}_${lastname.toUpperCase()}`;
    
    // Determine resource type for Cloudinary
    const resourceType = file.mimetype === 'application/pdf' ? 'raw' : 'image';

    console.log("📤 Uploading to Cloudinary:", { 
      LRN, 
      document_type, 
      folderPath, 
      resourceType 
    });

    // Upload to Cloudinary
    const uploadResult = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          folder: folderPath,
          public_id: file_name.replace(/\.[^/.]+$/, ""),
          resource_type: resourceType,
          overwrite: false,
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      ).end(file.data);
    });

    console.log("✅ Cloudinary upload successful:", uploadResult.secure_url);

    // Map document types to database columns
    const documentFieldMap = {
      'birth_cert': 'birth_cert',
      'form137': 'form137',
      'good_moral': 'good_moral',
      'report_card': 'report_card',
      'picture': 'picture',
      'transcript_records': 'transcript_records',
      'honorable_dismissal': 'honorable_dismissal'
    };

    const dbField = documentFieldMap[document_type];
    if (!dbField) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid document type" 
      });
    }

    // Check if student record exists in student_documents
    const [existingRecords] = await db.query(
      'SELECT * FROM student_documents WHERE LRN = ?',
      [LRN]
    );

    let result;
    if (existingRecords.length > 0) {
      // Update existing record
      const updateQuery = `UPDATE student_documents SET ${dbField} = ? WHERE LRN = ?`;
      [result] = await db.query(updateQuery, [uploadResult.secure_url, LRN]);
      console.log("📝 Updated existing document record");
    } else {
      // Insert new record
      const insertData = { LRN };
      insertData[dbField] = uploadResult.secure_url;
      
      const columns = Object.keys(insertData).join(', ');
      const placeholders = Object.keys(insertData).map(() => '?').join(', ');
      const values = Object.values(insertData);
      
      const insertQuery = `INSERT INTO student_documents (${columns}) VALUES (${placeholders})`;
      [result] = await db.query(insertQuery, values);
      console.log("🆕 Created new document record");
    }

    res.json({ 
      success: true, 
      message: "Document uploaded successfully",
      document_url: uploadResult.secure_url,
      document_type: document_type,
      LRN: LRN
    });

  } catch (err) {
    console.error("❌ Upload Error:", err.message);
    res.status(500).json({ 
      success: false, 
      message: "Upload failed", 
      details: err.message 
    });
  }
});

// === GET student documents ===
router.get("/student-documents", async (req, res) => {
  const { LRN } = req.query;

  if (!LRN) {
    return res.status(400).json({ 
      success: false, 
      message: "Missing student LRN" 
    });
  }

  try {
    const [rows] = await db.query(
      `SELECT * FROM student_documents WHERE LRN = ?`,
      [LRN]
    );

    if (rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: "No documents found for this student" 
      });
    }

    res.json({ 
      success: true, 
      documents: rows[0] 
    });
  } catch (err) {
    console.error("❌ DB Error:", err.message);
    res.status(500).json({ 
      success: false, 
      message: "Database error", 
      details: err.message 
    });
  }
});


export default router;

