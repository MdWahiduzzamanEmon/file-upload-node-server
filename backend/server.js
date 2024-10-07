const express = require("express");
const multer = require("multer");
const path = require("path");
const cors = require("cors");
const fs = require("fs");
const dotenv = require("dotenv");
const sanitize = require("sanitize-filename");
const rateLimit = require("express-rate-limit");
const morgan = require("morgan");
const sqlite3 = require("sqlite3").verbose();

dotenv.config();

const app = express();
const PORT = process.env.PORT || 2000;

// Enable CORS
app.use(cors());

// Logging
app.use(morgan("combined"));

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});
app.use(limiter);

app.use(express.static(path.join(__dirname, "../frontend")));
// Serve uploaded files
app.use("/media", express.static(path.join(__dirname, "uploads/apk")));

// Ensure uploads/apk directory exists
const uploadDir = path.join(__dirname, "uploads/apk");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Create or open the database
const db = new sqlite3.Database("./backend/uploads.db", (err) => {
  if (err) {
    console.error("Could not open database:", err);
  } else {
    // Create a table if it doesn't exist
    db.run(
      `CREATE TABLE IF NOT EXISTS uploaded_files (
        id INTEGER PRIMARY KEY,
        fileName TEXT NOT NULL,
        fileUrl TEXT NOT NULL,
        mimeType TEXT NOT NULL,
        fileSize REAL NOT NULL,
        apkVersion TEXT
      )`,
      (err) => {
        if (err) {
          console.error("Could not create table:", err);
        }
      }
    );
  }
});

// Configure Multer Storage and File Filter
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir); // Use the constant uploadDir
  },
  filename: function (req, file, cb) {
    const sanitizedFilename = sanitize(file.originalname);
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + sanitizedFilename);
  },
});

const fileFilter = function (req, file, cb) {
  const filetypes = /apk/;
  const mimetype = filetypes.test(file.originalname);
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

  if (mimetype && extname) {
    return cb(null, true);
  }
  cb(new Error("Only APK files are allowed"));
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 150 * 1024 * 1024 }, // 150MB
});

// Upload Endpoint with Directory and Database Clean-up
app.post("/uploadFile", (req, res) => {
  // Clean the uploads directory and reset the database
  cleanUploadsDirectory(uploadDir);
  resetDatabase();

  // Proceed with file upload
  upload.single("file")(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: err.message });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const fileUrl = `${req.protocol}://${req.get("host")}/media/${
      req.file.filename
    }`;
    const fileData = {
      fileName: req.file.originalname,
      fileUrl: fileUrl,
      mimeType: req.file.originalname.split(".").pop(),
      fileSize: Math.round(req.file.size / 1024) / 1024, // Convert bytes to MB
      apkVersion: req.file.originalname
        .split("-")[1]
        ?.split("(")[1]
        ?.slice(0, -1),
    };

    // Insert the new file data into the database
    db.run(
      `INSERT OR REPLACE INTO uploaded_files (id, fileName, fileUrl, mimeType, fileSize, apkVersion) VALUES (1, ?, ?, ?, ?, ?)`,
      [
        fileData.fileName,
        fileData.fileUrl,
        fileData.mimeType,
        fileData.fileSize,
        fileData.apkVersion,
      ],
      function (err) {
        if (err) {
          return res
            .status(500)
            .json({ error: "Could not save file info to database" });
        }
        // Respond with file information
        res.json({
          success: true,
          ...fileData,
        });
      }
    );
  });
});

// Function to clean the uploads directory
const cleanUploadsDirectory = (dir) => {
  fs.readdir(dir, (err, files) => {
    if (err) {
      console.error("Could not read directory:", err);
      return;
    }
    for (const file of files) {
      const filePath = path.join(dir, file);
      fs.unlink(filePath, (err) => {
        if (err) {
          console.error("Could not delete file:", err);
        }
      });
    }
  });
};

// Function to reset the database (delete all entries)
const resetDatabase = () => {
  db.run(`DELETE FROM uploaded_files`, (err) => {
    if (err) {
      console.error("Could not reset database:", err);
    }
  });
};

// New API Endpoint to retrieve the latest uploaded file info
app.get("/uploadedFiles", (req, res) => {
  db.get(`SELECT * FROM uploaded_files WHERE id = 1`, [], (err, row) => {
    if (err) {
      return res.status(500).json({ error: "Could not fetch uploaded file" });
    }
    res.json({
      success: true,
      file: row || null, // Return null if no file is found
    });
  });
});

// Add a route to serve the index.html file
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
