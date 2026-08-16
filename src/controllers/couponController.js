import Coupon from "../models/Coupon.js";

// إنشاء كوبون جديد (أدمن بس)
export const createCoupon = async (req, res) => {
  try {
    const { code, discountPercent, expiresAt, maxUses } = req.body;

    if (!code || !discountPercent) {
      return res
        .status(400)
        .json({ message: "code and discountPercent are required" });
    }

    const coupon = await Coupon.create({
      code,
      discountPercent,
      expiresAt: expiresAt || undefined,
      maxUses: maxUses || undefined,
    });

    res.status(201).json({ success: true, coupon });
  } catch (error) {
    if (error.code === 11000) {
      return res
        .status(400)
        .json({ message: "الكود ده مستخدم بالفعل، جرّب كود تاني" });
    }
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// جلب كل الكوبونات (أدمن بس)
export const getAllCoupons = async (req, res) => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 }).lean();
    res.status(200).json({ success: true, coupons });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// حذف كوبون (أدمن بس)
export const deleteCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Coupon.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ message: "Coupon not found" });
    }
    res.status(200).json({ success: true, message: "تم حذف الكوبون" });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};
