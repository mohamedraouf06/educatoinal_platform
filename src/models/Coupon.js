import mongoose from "mongoose";

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    discountPercent: { type: Number, required: true, min: 1, max: 100 },
    expiresAt: { type: Date },
    maxUses: { type: Number }, // لو فاضي = بلا حد
    usedCount: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

const Coupon = mongoose.model("Coupon", couponSchema);
export default Coupon;
