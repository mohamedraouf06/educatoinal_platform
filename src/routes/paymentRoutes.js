import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { initiatePayment, paymobWebhook } from "../controllers/paymentController.js";

const router = express.Router();

// 🔒 بدء عملية الدفع — لازم يكون الطالب مسجّل دخول
router.post("/initiate", authMiddleware, initiatePayment);

// 🌐 الـ Webhook بتاع Paymob — من غير authMiddleware لأن Paymob نفسه هو اللي بينادي عليه،
// الأمان هنا معتمد بالكامل على التحقق من الـ HMAC جوه الكنترولر
router.post("/webhook", paymobWebhook);

export default router;
