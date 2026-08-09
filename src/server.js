import dotenv from "dotenv";
dotenv.config();

import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import authRoutes from "./routes/authRoutes.js";
import courseRoutes from "./routes/courseRoutes.js";
import lessonRoutes from "./routes/lessonRoutes.js";
import emailRoutes from "./routes/emailRoutes.js";
import userRoutes from "./routes/userRoutes.js";
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
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

app.use(cors(corsOptions));

// 2️⃣ الإعدادات الصحيحة للحجم (مرة واحدة فقط)
app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ limit: "100mb", extended: true }));

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

// رووت تجريبي
app.get("/", (req, res) => {
  res.send("Welcome to the Teaching Platform Server (ES Modules)!");
});

// 🚀 تشغيل السيرفر
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server is running flawlessly on port ${PORT}`);
});
