import express from "express";
import {
  sendEmail,
  emailWebhook,
  getInbox,
  getSentEmails,
} from "../controllers/emailController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import adminMiddleware from "../middleware/adminMiddleware.js";
const router = express.Router();

router.post("/send", authMiddleware, adminMiddleware, sendEmail);

// استقبال الـ Webhook من Resend
router.post("/webhook", emailWebhook);

// جلب الإيميلات الواردة والصادرة
router.get("/inbox", authMiddleware, adminMiddleware, getInbox);
router.get("/sent", authMiddleware, adminMiddleware, getSentEmails);

export default router;
