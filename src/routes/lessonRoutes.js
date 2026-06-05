import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import adminMiddleware from "../middleware/adminMiddleware.js";
import {
  createLesson,
  getLessonsByCourse,
} from "../controllers/lessonController.js";

const router = express.Router();

// 🔒 Create a new lesson (Protected: Admins only)
router.post("/create", authMiddleware, adminMiddleware, createLesson);

// 🔒 Get lessons of a specific course (Protected: any logged-in user can view)
router.get("/course/:courseId", authMiddleware, getLessonsByCourse);

export default router;
