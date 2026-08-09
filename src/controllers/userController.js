import { User } from "../models/models.js";

// 1. جلب جميع المستخدمين
export const getAllUsers = async (req, res) => {
  try {
    // نجيب المستخدمين من غير ما نرجع الـ password للأمان
    const users = await User.find().select("-password").sort({ createdAt: -1 });
    res.status(200).json({ success: true, users });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "حدث خطأ أثناء جلب المستخدمين" });
  }
};

// 2. تحديث دور المستخدم (Role)
export const updateUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    // التأكد من إن الـ role القادم صحيح
    if (!["student", "admin"].includes(role)) {
      return res.status(400).json({ success: false, message: "دور غير صالح" });
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { role },
      { new: true },
    ).select("-password");

    if (!updatedUser) {
      return res
        .status(404)
        .json({ success: false, message: "المستخدم غير موجود" });
    }

    res.status(200).json({
      success: true,
      message: "تم تحديث دور المستخدم بنجاح",
      user: updatedUser,
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "حدث خطأ أثناء تحديث الدور" });
  }
};
