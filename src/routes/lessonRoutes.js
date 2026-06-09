import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import adminMiddleware from "../middleware/adminMiddleware.js";
import {
  createLesson,
  fakeEnrollCourse,
  getLessonsByCourse,
} from "../controllers/lessonController.js";
import upload from "../middleware/uploadMiddleware.js";

const router = express.Router();

// 🔒 Create a new lesson (Protected: Admins only)
router.post(
  "/create",
  authMiddleware,
  adminMiddleware,
  upload.single("video"),
  createLesson,
);
// 🔒 Get lessons of a specific course (Protected: any logged-in user can view)
router.get("/course/:courseId", authMiddleware, getLessonsByCourse);

// purchse
router.post("/enroll", authMiddleware, fakeEnrollCourse);
export default router;
