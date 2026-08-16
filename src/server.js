import dotenv from "dotenv";
dotenv.config();

import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import rateLimit from "express-rate-limit";
import authRoutes from "./routes/authRoutes.js";
import courseRoutes from "./routes/courseRoutes.js";
import lessonRoutes from "./routes/lessonRoutes.js";
import emailRoutes from "./routes/emailRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import studentRoutes from "./routes/studentRoutes.js";
import progressRoutes from "./models/progressRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import couponRoutes from "./routes/couponRoutes.js";
const app = express();

// 1️⃣ إعدادات CORS للسماح بالـ Localhost والـ Production على Vercel
const allowedOrigins = [
  "http://localhost:5173",
  "https://educatoinal-platform-frontend.vercel.app",
];

const corsOptions = {
  origin: function (origin, callback) {
    // السماح للطلبات من الدومينات المحددة أو الطلبات بدون origin (زي الـ Webhooks أو Postman)
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

app.use(cors(corsOptions));

// 2️⃣ حد الحجم العام لأي JSON/urlencoded body (رفع الفيديوهات/الصور بيمر عبر multer مش هنا)
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ limit: "1mb", extended: true }));

// 3️⃣ Rate Limiting العام لكل الـ API لمنع الـ Spam
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 دقيقة
  limit: 300, // 300 طلب لكل IP كل 15 دقيقة
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, please try again later." },
});
app.use("/api", globalLimiter);

// 4️⃣ Rate Limiting أشد صرامة على مسارات المصادقة لمنع الـ Brute Force
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 دقيقة
  limit: 10, // 10 محاولات فقط لكل IP كل 15 دقيقة
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many attempts, please try again in a few minutes.",
  },
});
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);
app.use("/api/auth/forgot-password", authLimiter);

// 🔌 الاتصال بقاعدة البيانات MongoDB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Connected to MongoDB successfully!"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// 🚦 الـ Routes
app.use("/api/auth", authRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/lessons", lessonRoutes);
app.use("/api/emails", emailRoutes);
app.use("/api/admin", userRoutes);
app.use("/api/student", studentRoutes);
app.use("/api/progress", progressRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/coupons", couponRoutes);

// رووت تجريبي
app.get("/", (req, res) => {
  res.send("Welcome to the Teaching Platform Server (ES Modules)!");
});

// 5️⃣ Global Express Error Handler (لازم يكون آخر middleware)
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error("❌ UNHANDLED EXPRESS ERROR:", err);

  if (res.headersSent) {
    return next(err);
  }

  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});

// 6️⃣ مصايد لأي Rejection أو Exception ما اتمسكتش جوه try/catch
// بتمنع كراش السيرفر بالكامل بسبب خطأ غير متوقع في أي مكان
process.on("unhandledRejection", (reason) => {
  console.error("❌ UNHANDLED PROMISE REJECTION:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("❌ UNCAUGHT EXCEPTION:", err);
});

// 🚀 تشغيل السيرفر
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server is running flawlessly on port ${PORT}`);
});
