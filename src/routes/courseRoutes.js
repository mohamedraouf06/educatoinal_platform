// routes/courseRoutes.js
import express from "express";
import { createCourse } from "../controllers/courseController.js";

// 🔥 التصحيح هنا: لازم نكتب اسم الملف بالكامل والامتداد .js في الآخر
import authMiddleware from "../middleware/authMiddleware.js";
import adminMiddleware from "../middleware/adminMiddleware.js";

const router = express.Router();

// Protected route
router.post("/create", authMiddleware, adminMiddleware, createCourse);

export default router;
