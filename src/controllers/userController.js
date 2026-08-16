import { User } from "../models/models.js";

// 1. جلب جميع المستخدمين
export const getAllUsers = async (req, res) => {
  try {
    // Pagination: لو مفيش page/limit في الطلب، بنرجع أول 50 مستخدم بس
    // (مش كل المستخدمين دفعة واحدة) عشان الاستجابة تفضل خفيفة مهما كبر عدد المستخدمين
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const skip = (page - 1) * limit;

    // Projection: بنجيب بس الحقول اللي شاشة إدارة المستخدمين فعلاً بتعرضها
    // (name, email, role) — من غير password ولا enrolledCourses اللي مش مستخدمة هناك
    const [users, total] = await Promise.all([
      User.find()
        .select("name email role createdAt")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(),
    ]);

    res.status(200).json({
      success: true,
      users,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
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

// حذف مستخدم
export const deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const deletedUser = await User.findByIdAndDelete(userId);

    if (!deletedUser) {
      return res
        .status(404)
        .json({ success: false, message: "المستخدم غير موجود" });
    }

    res.status(200).json({
      success: true,
      message: "تم حذف المستخدم بنجاح",
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "حدث خطأ أثناء حذف المستخدم" });
  }
};
