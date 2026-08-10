import { randomBytes, createHash } from "node:crypto";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { User } from "../models/models.js";

// ==========================================
// REGISTER LOGIC
// ==========================================
export const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // 1. Validation: Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res
        .status(400)
        .json({ message: "This email is already registered!" });
    }

    // 2. Security: Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 3. Creation: Create new user document
    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      role: "student",
    });

    // 4. Persistence: Save to MongoDB
    await newUser.save();

    res
      .status(201)
      .json({ message: "User registered successfully!", status: "success" });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ==========================================
// LOGIN LOGIC
// ==========================================
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Check if the user exists in the database
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid Email or Password!" });
    }

    // 2. Compare incoming plain text password with the stored hashed password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid Email or Password!" });
    }

    // 3. Generate a secure JWT Token containing user payload (ID and Role)
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET || "HQIJUSWRUOE8TQWRR84810WQREWRW",
      { expiresIn: "7d" }, // Token expires in 7 days for security reasons
    );

    // 4. Send back the token and public user profile details
    res.status(200).json({
      message: "Logged in successfully!",
      status: "success",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ==========================================
// GET USER PROFILE
// ==========================================
export const getUserProfile = async (req, res) => {
  try {
    const currentuser = await User.findById(req.user.userId).select(
      "-password",
    );
    if (!currentuser) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(200).json({ status: "success", user: currentuser });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ==========================================
// FORGOT PASSWORD
// ==========================================
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      // إرجاع استجابة نجاح لمنع الـ Email Enumeration للحفاظ على الأمان
      return res.json({
        success: true,
        message: "لو الإيميل مسجل عندنا، هتوصلك رسالة بالتعليمات.",
      });
    }

    // توليد التوكن وتحديد وقت صلاحية (15 دقيقة)
    const resetToken = randomBytes(32).toString("hex");
    const hashedToken = createHash("sha256").update(resetToken).digest("hex");

    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = Date.now() + 15 * 60 * 1000; // 15 دقيقة
    await user.save();

    // رابط إعادة التعيين للعميل
    const resetUrl = `http://localhost:5173/reset-password/${resetToken}`;

    // 📝 طباعة الرابط في الـ Terminal للتجربة (بدل إرسال إيميل)
    console.log("----------------------------------------");
    console.log("🔗 RESET PASSWORD LINK:");
    console.log(resetUrl);
    console.log("----------------------------------------");

    res.json({
      success: true,
      message:
        "تم إرسال رابط إعادة التعيين بنجاح (افحص الـ Terminal لرؤية الرابط).",
    });
  } catch (err) {
    console.error("Forgot Password Error:", err);
    res.status(500).json({ success: false, message: "حدث خطأ في السيرفر" });
  }
};

// ==========================================
// RESET PASSWORD
// ==========================================
export const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { newPassword } = req.body;

    // تشفير التوكن القادم للبحث عنه في الداتابيز
    const hashedToken = createHash("sha256").update(token).digest("hex");

    // البحث عن المستخدم والتأكد من أن التوكن لم تنتهِ صلاحيته
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res
        .status(400)
        .json({ success: false, message: "الرابط غير صالح أو انتهت صلاحيته." });
    }

    // تشفير كلمة السر الجديدة وتصفير التوكن
    user.password = await bcrypt.hash(newPassword, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({
      success: true,
      message: "تم تغيير كلمة السر بنجاح! يمكنك التسجيل الآن.",
    });
  } catch (err) {
    console.error("Reset Password Error:", err);
    res.status(500).json({ success: false, message: "حدث خطأ في السيرفر" });
  }
};
