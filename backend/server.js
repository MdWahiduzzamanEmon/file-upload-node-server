import express from "express";
import multer, { diskStorage, MulterError } from "multer";
import { join, extname as _extname } from "path";
import cors from "cors";
import { existsSync, mkdirSync, readdir, unlink } from "fs";
import { config } from "dotenv";
import sanitize from "sanitize-filename";
import rateLimit from "express-rate-limit";
import morgan from "morgan";
import { fileURLToPath } from "url";
import sqlite3 from "sqlite3"; // Importing SQLite
import fs from "fs";
import helmet from "helmet";

config(); // Load environment variables

// Create __dirname for ES modules
const __filename = fileURLToPath(import.meta.url); // Correctly resolve __filename
const __dirname = join(__filename, "../.."); // Correctly resolve __dirname. this is endicates file is in backend directory

// Express app setup
const app = express();
const PORT = process.env.PORT || 2000;

// Enable CORS
app.use(cors());

// Logging middleware
app.use(
  morgan("common", {
    stream: fs.createWriteStream(join(__dirname, "access.log"), {
      flags: "a",
    }),
  })
);

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
});

app.use(limiter);
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      fontSrc: ["'self'"],
      imgSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      frameSrc: ["'self'"],
    },
    reportOnly: true, // Set to 'true' to enable report-only mode
  })
);

// Serve static files from the frontend directory
app.use(express.static(join(__dirname, "frontend"))); // Correctly serve frontend assets

// Ensure uploads/apk directory exists
const uploadDir = join(__dirname, "backend/uploads/apk");

if (!existsSync(uploadDir)) {
  mkdirSync(uploadDir, { recursive: true });
}

// Serve uploaded files from the uploads directory
app.use("/media", express.static(uploadDir));

// Initialize SQLite database
const db = new sqlite3.Database(
  join(__dirname, "backend/uploads.db"),
  (err) => {
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
  }
);

// Multer setup for file uploads
const storage = diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir); // Use the constant uploadDir
  },
  filename: function (req, file, cb) {
    const sanitizedFilename = sanitize(file.originalname);
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + sanitizedFilename);
  },
});

// File filter for allowing only APK files
const fileFilter = function (req, file, cb) {
  const filetypes = /apk/;
  const mimetype = filetypes.test(file.originalname);
  const extname = filetypes.test(_extname(file.originalname).toLowerCase());

  if (mimetype && extname) {
    return cb(null, true);
  }
  cb(new Error("Only APK files are allowed"));
};

// Multer instance
const upload = multer({
  storage: storage,
  limits: { fileSize: 150 * 1024 * 1024 }, // Limit file size to 150MB
  fileFilter: fileFilter,
});

// Upload Endpoint
app.post("/uploadFile", (req, res) => {
  // Clean the uploads directory and reset the database before new upload
  cleanUploadsDirectory(uploadDir);
  resetDatabase();

  // Proceed with file upload
  upload.single("file")(req, res, function (err) {
    if (err instanceof MulterError) {
      return res.status(400).json({ error: err.message });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // console.log("Uploaded file path:", join(uploadDir, req.file.filename));

    const fileUrl = `${req.protocol}://${req.get(
      "host"
    )}/media/${encodeURIComponent(req.file.filename)}`;

    // console.log("File URL:", fileUrl);

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

    // Insert file data into the database
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
  readdir(dir, (err, files) => {
    if (err) {
      console.error("Could not read directory:", err);
      return;
    }
    for (const file of files) {
      const filePath = join(dir, file);
      unlink(filePath, (err) => {
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

// Endpoint to retrieve the latest uploaded file info
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

// Serve index.html from frontend directory
app.get("/", (req, res) => {
  res.sendFile(join(__dirname, "frontend/index.html"));
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
