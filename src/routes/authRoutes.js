// routes/authRoutes.js
import express from "express";
import {
  getUserProfile,
  loginUser,
  registerUser,
} from "../controllers/authController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

// توجيه رابط الـ register للفانكشن بتاعته في الكنترولر
router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/me", authMiddleware, getUserProfile);

export default router;
