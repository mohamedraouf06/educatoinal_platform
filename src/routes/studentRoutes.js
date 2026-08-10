import express from "express";
import {
  getMyCourses,
  getCourseDetailsForStudent,
} from "../controllers/studentController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

// Protect all student routes
router.get("/my-courses", authMiddleware, getMyCourses);
router.get("/courses/:courseId", authMiddleware, getCourseDetailsForStudent);

export default router;
