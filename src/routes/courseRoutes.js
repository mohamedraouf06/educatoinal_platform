import express from "express";
import {
  createCourse,
  deleteCourse,
  getAllCourses,
  updateCourse,
} from "../controllers/courseController.js";

import authMiddleware from "../middleware/authMiddleware.js";
import adminMiddleware from "../middleware/adminMiddleware.js";
import multer from "multer";

const router = express.Router();

// Define temporary memory storage for the course image buffer
const storage = multer.memoryStorage();

// Create a specific image uploader middleware that allows images (png, jpeg, jpg, webp)
const uploadImage = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true); // Accept the file if it's an image
    } else {
      cb(
        new Error("Only image files are allowed for the course thumbnail!"),
        false,
      );
    }
  },
});

router.post(
  "/create",
  authMiddleware,
  adminMiddleware,
  uploadImage.single("thumbnail"),
  createCourse,
); // Create a new course

router.get("/all", getAllCourses); // Get all courses
router.delete("/:id", authMiddleware, adminMiddleware, deleteCourse); // Delete a specific course
router.put("/:id", authMiddleware, adminMiddleware, updateCourse); // Update a specific course

export default router;
