import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import adminMiddleware from "../middleware/adminMiddleware.js";
import {
  createLesson,
  getLessonsByCourse,
  updateLesson,
  deleteLesson,
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
// 🌐 عام: أي زائر (حتى مش مسجل دخول) يقدر يشوف الفهرس ويشغّل دروس المعاينة المجانية.
// التحقق من التوثيق (لو موجود) بيحصل جوه الكنترولر نفسه عشان نفرّق بين
// زائر / طالب مسجل غير مشترك / طالب مشترك / أدمن، من غير ما نمنع الزائر تمامًا
router.get("/course/:courseId", getLessonsByCourse);

// 🔒 تعديل/حذف درس (أدمن بس) — الكنترولرز دي كانت موجودة من غير أي route ليها خالص
router.put("/:id", authMiddleware, adminMiddleware, updateLesson);
router.delete("/:id", authMiddleware, adminMiddleware, deleteLesson);

export default router;
