import express from "express";

import authMiddleware from "../middleware/authMiddleware.js";
import {
  getCourseProgress,
  toggleLessonCompletion,
  updateLastAccessed,
} from "../controllers/progressController.js";

const router = express.Router();

// جلب تقدم الطالب في كورس معين
router.get("/:courseId", authMiddleware, getCourseProgress);

// تعليم درس كـ Completed أو Unmark
router.post("/toggle-lesson", authMiddleware, toggleLessonCompletion);

// تحديث آخر درس تم فتحه
router.post("/update-last-accessed", authMiddleware, updateLastAccessed);

export default router;
