// Models.js
import mongoose from "mongoose";

// ==========================================
// 1. USER SCHEMA (Student / Admin)
// ==========================================
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true }, // unique ensures no duplicate accounts with the same email
  password: { type: String, required: true }, // Will be hashed using bcrypt later
  role: { type: String, enum: ["student", "admin"], default: "student" }, // Authorization levels

  // Magic Array: Stores the IDs of the courses this specific student has paid for
  enrolledCourses: [{ type: mongoose.Schema.Types.ObjectId, ref: "Course" }],

  // ⚠️ الحقلين دول كانوا بيتستخدموا في authController.js (forgot/reset password)
  // من غير ما يكونوا معرّفين في الـ schema — يعني Mongoose كان بيتجاهلهم بصمت
  // وقت الـ save() (السلوك الافتراضي strict: true)، فعملية استرجاع كلمة السر
  // كانت فاشلة دايمًا من الأساس، حتى لو الإيميل وصل بنجاح.
  resetPasswordToken: { type: String },
  resetPasswordExpires: { type: Date },
});

// ==========================================
// 2. COURSE SCHEMA (The Big Umbrella)
// ==========================================
const courseSchema = new mongoose.Schema(
  {
    title: { type: String, required: true }, // e.g., "Node.js BootCamp"
    description: { type: String },
    price: { type: Number, required: true },
    thumbnail: { type: String }, // URL of the course cover image

    // بيانات لصفحة تفاصيل الكورس (تبديد شك الطالب قبل الشراء)
    instructorName: { type: String },
    instructorBio: { type: String },
    whatYouWillLearn: [{ type: String }],

    // كورسات تانية الأدمن بيرشحها كـ "ممكن يعجبك كمان" — يدوي مش محرك توصية
    relatedCourses: [{ type: mongoose.Schema.Types.ObjectId, ref: "Course" }],
  },
  {
    toJSON: { virtuals: true }, // لتمكين إظهار الـ virtuals لما نحول لـ JSON
    toObject: { virtuals: true },
  },
);

// Virtual populate: يربط الكورس بالدروس الخاصة بيه عبر courseId
courseSchema.virtual("lessons", {
  ref: "Lesson", // اسم الموديل بتاع الدروس
  localField: "_id", // حقل الـ ID في الكورس
  foreignField: "courseId", // حقل الـ courseId في موديل الدرس
});

// ==========================================
// 3. LESSON SCHEMA (Videos Inside The Course)
// ==========================================
const lessonSchema = new mongoose.Schema({
  // Relationship: Connects each lesson to its parent course (One-to-Many)
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Course",
    required: true,
  },
  title: { type: String, required: true }, // e.g., "Lesson 1: Introduction to Express"
  videoUrl: { type: String, required: true }, // ⚠️ بيخزن Bunny Stream videoId (guid) مش رابط كامل — الرابط الموقّع بيتبني ديناميك في lessonController.js
  duration: { type: Number, default: 0 }, // بالدقايق، للعرض بس
  isFreePreview: { type: Boolean, default: false }, // لو true، أي زائر (حتى مش مشترك) يقدر يشغّله
  order: { type: Number, default: 0 }, // ترتيب الدرس جوه الكورس
});

// Index بيسرّع أي استعلام بيفلتر الدروس حسب الكورس (getLessonsByCourse, populate("lessons"))
lessonSchema.index({ courseId: 1 });

// ==========================================
// 4. EMAIL SCHEMA (For Sending Emails)
// ==========================================
const emailSchema = new mongoose.Schema(
  {
    from: {
      type: String,
      required: true,
    },
    to: {
      type: String,
      required: true,
    },
    subject: {
      type: String,
      default: "",
    },
    message: {
      type: String,
      default: "",
    },
    direction: {
      type: String,
      enum: ["inbound", "outbound"], // inbound = وارد, outbound = صادر
      required: true,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    receivedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

// بيسرّع فلترة الـ Inbox/Sent اللي بتعمل بحث بالـ direction في كل مرة
emailSchema.index({ direction: 1 });

// Convert Schemas into usable Mongoose Models
export const User = mongoose.model("User", userSchema);
export const Course = mongoose.model("Course", courseSchema);
export const Lesson = mongoose.model("Lesson", lessonSchema);
export const Email = mongoose.model("Email", emailSchema);
