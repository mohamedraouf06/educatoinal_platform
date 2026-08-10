// routes/authRoutes.js
import express from "express";
import {
  forgotPassword,
  getUserProfile,
  loginUser,
  registerUser,
  resetPassword,
} from "../controllers/authController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

// توجيه رابط الـ register للفانكشن بتاعته في الكنترولر
router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/me", authMiddleware, getUserProfile);
// 🔑 Password Reset Routes
router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:token", resetPassword);
export default router;
