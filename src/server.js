// server.js
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/authRoutes.js";
import courseRoutes from "./routes/courseRoutes.js";
// تشغيل الـ dotenv لقراءة ملف الـ .env
dotenv.config();

const app = express();

// Middlewares أساسية للسيستم
app.use(cors()); // السماح للفرونت إيند بطلب الداتا
app.use(express.json()); // فهم داتا الـ JSON المبعوتة من الفورمز

// 🔌 الاتصال بقاعدة البيانات MongoDB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Connected to MongoDB successfully!"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

app.use("/api/auth", authRoutes);
app.use("/api/courses", courseRoutes);
// رووت تجريبي
app.get("/", (req, res) => {
  res.send("Welcome to the Teaching Platform Server (ES Modules)!");
});

// 🚀 تشغيل السيرفر
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server is running flawlessly on http://localhost:${PORT}`);
});
