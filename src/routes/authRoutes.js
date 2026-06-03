// routes/authRoutes.js
import express from "express";
import { loginUser, registerUser } from "../controllers/authController.js";

const router = express.Router();

// توجيه رابط الـ register للفانكشن بتاعته في الكنترولر
router.post("/register", registerUser);
router.post("/login", loginUser);

export default router;
