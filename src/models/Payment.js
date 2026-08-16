import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
    },
    amountCents: { type: Number, required: true },
    // رقم الأوردر عند Paymob — بنستخدمه نربط بيه الـ webhook بعملية الدفع الصحيحة
    paymobOrderId: { type: Number, required: true, unique: true },
    couponCode: { type: String },
    discountPercent: { type: Number },
    status: {
      type: String,
      enum: ["pending", "success", "failed"],
      default: "pending",
    },
  },
  { timestamps: true },
);

// بتسرّع أي استعلام مستقبلي زي "كل عمليات الدفع بتاعة طالب معين" أو "بتاعة كورس معين"
paymentSchema.index({ userId: 1 });
paymentSchema.index({ courseId: 1 });

const Payment = mongoose.model("Payment", paymentSchema);
export default Payment;
