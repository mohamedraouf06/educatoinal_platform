import { Resend } from "resend";
import { User, Course, Email } from "../models/models.js";
import Payment from "../models/Payment.js";
import Coupon from "../models/Coupon.js";

const resend = new Resend(process.env.RESEND_API_KEY);
import {
  getPaymobAuthToken,
  createPaymobOrder,
  getPaymobPaymentKey,
  buildPaymobIframeUrl,
  verifyPaymobHmac,
} from "../utils/paymob.js";

// إيميل ترحيبي بعد نجاح الدفع — نفس نمط sendEmail في emailController.js
// (بيتحفظ كمان في جدول Email عشان يظهر في تبويب "Sent" بلوحة الأدمن)
async function sendPurchaseConfirmationEmail(user, course) {
  const courseTitle = course?.title || "الكورس";
  const subject = `تم تفعيل اشتراكك في ${courseTitle}!`;
  const message = `أهلاً ${user.name || ""}،\n\nمبروك! تم تأكيد دفعك وتفعيل اشتراكك في "${courseTitle}" بنجاح.\nتقدر تبدأ المذاكرة فورًا من صفحة "My Learning".\n\nبالتوفيق في رحلتك التعليمية!`;

  const { error } = await resend.emails.send({
    from: "German Academy <onboarding@resend.dev>",
    to: [user.email],
    subject,
    text: message,
  });

  if (error) {
    console.warn("⚠️ Resend API error while sending purchase email:", error);
    return;
  }

  await Email.create({
    from: "onboarding@resend.dev",
    to: user.email,
    subject,
    message,
    direction: "outbound",
    receivedAt: new Date(),
  });
}

// 1) بدء عملية الدفع — بيرجع رابط صفحة Paymob اللي الفرونت إند بيوجّه الطالب لها
export const initiatePayment = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { courseId, couponCode } = req.body;

    if (!courseId) {
      return res.status(400).json({ message: "courseId is required" });
    }

    const [user, course] = await Promise.all([
      // ⚠️ مش بنحط .lean() هنا عشان محتاجين enrolledCourses.includes() تفضل شغالة
      // وبنجيب بس name/email/enrolledCourses، دول الحقول المستخدمة هنا فقط
      User.findById(userId).select("name email enrolledCourses"),
      // course بنقرا منه بس السعر، من غير أي تعديل عليه، فآمن نستخدم .lean()
      Course.findById(courseId).select("price").lean(),
    ]);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }
    if (user.enrolledCourses.includes(courseId)) {
      return res
        .status(400)
        .json({ message: "You are already enrolled in this course" });
    }

    // 🎯 المبلغ بيتحسب من سعر الكورس المخزّن في السيرفر مباشرة — مش من أي قيمة جاية من الفرونت،
    // عشان محدش يقدر يعدّل السعر من عنده وقت الطلب
    let amountCents = Math.round(course.price * 100);
    let appliedCoupon = null;

    // لو الطالب دخّل كود كوبون، بنتحقق منه من السيرفر (موجود، مفعّل، لسه صالح، تحت الحد الأقصى للاستخدام)
    if (couponCode) {
      const coupon = await Coupon.findOne({
        code: couponCode.trim().toUpperCase(),
        active: true,
      });

      if (!coupon) {
        return res.status(400).json({ message: "كود الخصم غير صحيح" });
      }
      if (coupon.expiresAt && coupon.expiresAt < new Date()) {
        return res.status(400).json({ message: "كود الخصم منتهي الصلاحية" });
      }
      if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
        return res
          .status(400)
          .json({ message: "كود الخصم وصل للحد الأقصى من الاستخدام" });
      }

      amountCents = Math.round(amountCents * (1 - coupon.discountPercent / 100));
      appliedCoupon = coupon;
    }

    const authToken = await getPaymobAuthToken();
    const paymobOrderId = await createPaymobOrder(authToken, amountCents);

    const payment = await Payment.create({
      userId,
      courseId,
      amountCents,
      paymobOrderId,
      status: "pending",
      couponCode: appliedCoupon?.code,
      discountPercent: appliedCoupon?.discountPercent,
    });

    const nameParts = (user.name || "Student").trim().split(" ");
    const paymentToken = await getPaymobPaymentKey(
      authToken,
      amountCents,
      paymobOrderId,
      {
        email: user.email,
        firstName: nameParts[0] || "Student",
        lastName: nameParts.slice(1).join(" ") || "Student",
      },
    );

    const paymentUrl = buildPaymobIframeUrl(paymentToken);

    return res.status(200).json({
      success: true,
      paymentUrl,
      paymentId: payment._id,
    });
  } catch (err) {
    console.error("❌ Paymob initiate payment error:", err);
    return res
      .status(500)
      .json({ message: "Failed to initiate payment", error: err.message });
  }
};

// 2) الـ Webhook — Paymob بينادي عليه بعد أي عملية دفع (نجحت أو فشلت)
// الأمان كله معتمد على التحقق من الـ HMAC هنا، مش على أي حاجة جاية من المتصفح
export const paymobWebhook = async (req, res) => {
  try {
    const receivedHmac = req.query.hmac;
    const transaction = req.body?.obj;

    if (!receivedHmac || !transaction) {
      return res.status(400).json({ message: "Invalid webhook payload" });
    }

    const isValid = verifyPaymobHmac(transaction, receivedHmac);
    if (!isValid) {
      console.warn(
        "⚠️ Paymob webhook HMAC verification FAILED — possible forged request, ignoring.",
      );
      return res.status(401).json({ message: "Invalid signature" });
    }

    const paymobOrderId = transaction.order?.id;
    const payment = await Payment.findOne({ paymobOrderId });

    if (!payment) {
      console.warn(
        `⚠️ Paymob webhook: no matching payment record for order ${paymobOrderId}`,
      );
      return res.status(404).json({ message: "Payment record not found" });
    }

    // Idempotency: لو اتعالجت قبل كده (Paymob ممكن يبعت نفس الـ webhook أكتر من مرة)
    if (payment.status === "success") {
      return res.status(200).json({ message: "Already processed" });
    }

    const isSuccess = transaction.success === true || transaction.success === "true";

    if (isSuccess) {
      payment.status = "success";
      await payment.save();

      // بنزوّد عداد استخدام الكوبون هنا بس، بعد تأكيد الدفع الفعلي —
      // مش وقت initiatePayment، عشان لو الطالب سابت الدفع في النص الكوبون ميتحرقش
      if (payment.couponCode) {
        await Coupon.updateOne(
          { code: payment.couponCode },
          { $inc: { usedCount: 1 } },
        );
      }

      const user = await User.findById(payment.userId).select(
        "name email enrolledCourses",
      );
      if (user && !user.enrolledCourses.includes(payment.courseId.toString())) {
        user.enrolledCourses.push(payment.courseId);
        await user.save();
      }

      // 📧 إيميل ترحيبي بعد الشراء — مش بنوقف الـ webhook لو الإرسال فشل
      if (user) {
        const course = await Course.findById(payment.courseId)
          .select("title")
          .lean();
        await sendPurchaseConfirmationEmail(user, course).catch((emailErr) =>
          console.warn(
            "⚠️ Failed to send purchase confirmation email:",
            emailErr.message,
          ),
        );
      }
    } else {
      payment.status = "failed";
      await payment.save();
    }

    return res.status(200).json({ message: "Webhook processed" });
  } catch (err) {
    console.error("❌ Paymob webhook processing error:", err);
    return res.status(500).json({ message: "Webhook processing error" });
  }
};
