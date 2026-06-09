// server.js
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import authRoutes from "./routes/authRoutes.js";
import courseRoutes from "./routes/courseRoutes.js";
import lessonRoutes from "./routes/lessonRoutes.js";

const app = express();

// الإعدادات الصحيحة للحجم مرة واحدة فقط
app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ limit: "100mb", extended: true }));

const corsOptions = {
  origin: "http://localhost:5173",
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

app.use(cors(corsOptions)); //
// Middlewares أساسية للسيستم
app.use(cors(corsOptions)); // السماح للفرونت إيند بطلب الداتا
app.use(express.json()); // فهم داتا الـ JSON المبعوتة من الفورمز

// 🔌 الاتصال بقاعدة البيانات MongoDB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Connected to MongoDB successfully!"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

app.use("/api/auth", authRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/lessons", lessonRoutes);
// رووت تجريبي
app.get("/", (req, res) => {
  res.send("Welcome to the Teaching Platform Server (ES Modules)!");
});

// 🚀 تشغيل السيرفر
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server is running flawlessly on http://localhost:${PORT}`);
});
