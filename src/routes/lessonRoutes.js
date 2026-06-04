import express from "express";
import authMiddleware from "../middleware/authMiddleware";
import adminMiddleware from "../middleware/adminMiddleware";
import {
  createLesson,
  getLessonsBycourse,
} from "../controllers/lessonController";

const router = express.Router();

// 🔒 Create a new lesson (Protected: Admins only)
router.post("/create", authMiddleware, adminMiddleware, createLesson);

// 🔒 Get lessons of a specific course (Protected: any logged-in user can view)
router.get("/course/:courseId", authMiddleware, getLessonsBycourse);

export default router;
