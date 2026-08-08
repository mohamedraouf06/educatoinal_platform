import { Resend } from "resend";
import { Email } from "../models/models.js";

const resend = new Resend(process.env.RESEND_API_KEY);

// 1️⃣ إرسال إيميل وحفظه كـ Sent في الداتابيز
export const sendEmail = async (req, res) => {
  try {
    const { to, subject, message } = req.body;

    if (!to || !subject || !message) {
      return res.status(400).json({
        message: "To, subject and message are required",
      });
    }

    const { data, error } = await resend.emails.send({
      from: " German Academy <onboarding@resend.dev>",
      to: [to],
      subject,
      text: message,
    });

    if (error) {
      return res.status(400).json({
        message: "Failed to send email",
        error,
      });
    }

    // 💾 حفظ الإيميل الصادر في قاعدة البيانات
    const savedEmail = await Email.create({
      from: "onboarding@resend.dev",
      to,
      subject,
      message,
      direction: "outbound", // أو sent
      receivedAt: new Date(),
    });

    res.status(200).json({
      message: "Email sent successfully",
      data,
      savedEmail,
    });
  } catch (error) {
    res.status(500).json({
      message: "Server Error",
      error: error.message,
    });
  }
};

// 2️⃣ استقبال الـ Webhook وحفظ الإيميل الوارد
export const emailWebhook = async (req, res) => {
  try {
    console.log("🔥 WEBHOOK HIT");
    const { type, data } = req.body;

    if (type === "email.received" || type === "email.delivered") {
      await Email.create({
        from: data.from,
        to: Array.isArray(data.to) ? data.to[0] : data.to,
        subject: data.subject,
        message: data.text || "",
        direction: "inbound",
        receivedAt: new Date(data.created_at || Date.now()),
      });
      console.log("✅ Inbound Email Saved");
    }

    res.status(200).json({
      message: "Webhook processed successfully",
    });
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(500).json({
      message: "Webhook error",
      error: error.message,
    });
  }
};

// 3️⃣ جلب البريد الوارد (Inbox) 👈 اللي كانت ناقصة ومسببة Error
export const getInbox = async (req, res) => {
  try {
    // بيجيب الرسائل الواردة فقط أو الرسائل اللي مش outbound
    const emails = await Email.find({ direction: { $ne: "outbound" } }).sort({
      receivedAt: -1,
    });

    res.status(200).json({
      status: "success",
      emails,
    });
  } catch (error) {
    res.status(500).json({
      message: "Server Error",
      error: error.message,
    });
  }
};

// 4️⃣ جلب البريد الصادر (Sent)
export const getSentEmails = async (req, res) => {
  try {
    const emails = await Email.find({ direction: "outbound" }).sort({
      receivedAt: -1,
    });

    res.status(200).json({
      status: "success",
      emails,
    });
  } catch (error) {
    res.status(500).json({
      message: "Server Error",
      error: error.message,
    });
  }
};
