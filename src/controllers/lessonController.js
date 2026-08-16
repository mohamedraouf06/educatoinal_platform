import jwt from "jsonwebtoken";
import { Lesson, User } from "../models/models.js";
import {
  createBunnyVideo,
  uploadVideoToBunny,
  deleteBunnyVideo,
  withSignedVideoUrl,
} from "../utils/bunnyStream.js";

const JWT_SECRET = process.env.JWT_SECRET;

// بيحاول يفك التوكن لو موجود، من غير ما يرفض الطلب لو مفيش توكن أو كان غلط —
// بيعامل أي حالة فاشلة كـ "زائر عادي" بدل ما يمنعه، عشان دروس المعاينة تفضل متاحة للكل
function getOptionalUser(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ") || !JWT_SECRET) {
    return null;
  }
  try {
    return jwt.verify(authHeader.split(" ")[1], JWT_SECRET);
  } catch {
    return null;
  }
}

// create a new lesson (admin only)
export const createLesson = async (req, res) => {
  try {
    const { title, courseId, duration, isFreePreview, order } = req.body;

    // 1. Validation
    if (!title || !courseId) {
      return res.status(400).json({
        message: "Please provide title and courseId for the lesson.",
      });
    }

    // 2. Validation
    if (!req.file) {
      return res.status(400).json({
        message: "Please upload a video file for this lesson.",
      });
    }

    // 3. بننشئ سجل الفيديو في مكتبة Bunny الأول عشان ناخد الـ videoId
    const videoId = await createBunnyVideo(title);

    // 4. بنرفع محتوى الفيديو الفعلي على نفس الـ videoId ده
    await uploadVideoToBunny(videoId, req.file.buffer);

    // 5. بنخزن الـ videoId بس (مش رابط كامل) — الرابط بيتبني وقت الطلب في withSignedVideoUrl
    const newLesson = new Lesson({
      title,
      videoUrl: videoId,
      courseId,
      duration: duration ? Number(duration) : 0,
      isFreePreview: isFreePreview === "true" || isFreePreview === true,
      order: order ? Number(order) : 0,
    });

    await newLesson.save();

    res
      .status(201)
      .json({ message: "Lesson created successfully!", lesson: newLesson });
  } catch (err) {
    console.error("❌ BUNNY UPLOAD CRASH:", err);
    res.status(500).json({
      message: "Server error while creating lesson",
      error: err.message,
    });
  }
};

export const getLessonsByCourse = async (req, res) => {
  try {
    const { courseId } = req.params;

    // بنحاول نفك التوكن لو موجود، من غير ما نمنع الزائر اللي مفيش عنده توكن أصلاً
    const decoded = getOptionalUser(req);
    const userId = decoded?.userId;
    const userRole = decoded?.role;

    // 1. الفهرس العام: كل الدروس بعناوينها، وأي درس معاينة مجانية بيتبعت برابط فيديو فعلي وموقّع
    const allLessons = await Lesson.find({ courseId }).sort({ order: 1 }).lean();
    const previewableLessons = allLessons.map((lesson) =>
      lesson.isFreePreview
        ? withSignedVideoUrl(lesson)
        : { ...lesson, videoUrl: undefined },
    );

    // 2. أدمن: وصول كامل لكل الدروس والفيديوهات
    if (userRole === "admin") {
      return res.status(200).json({
        lessons: allLessons.map(withSignedVideoUrl),
        isEnrolled: true,
      });
    }

    // 3. زائر مش مسجل دخول خالص — بيشوف الفهرس + دروس المعاينة المجانية بس
    if (!userId) {
      return res
        .status(200)
        .json({ lessons: previewableLessons, isEnrolled: false });
    }

    // بنجيب بس enrolledCourses، ده الحقل الوحيد المستخدم هنا
    const user = await User.findById(userId).select("enrolledCourses");

    // لو التوكن بتاع مستخدم اتمسح من الداتابيز، بنعامله زي الزائر مش بنرفض الطلب
    if (!user) {
      return res
        .status(200)
        .json({ lessons: previewableLessons, isEnrolled: false });
    }

    // English comment: Verify if the student has access to this course
    const hasAccess =
      user.enrolledCourses && user.enrolledCourses.includes(courseId);

    if (hasAccess) {
      // If enrolled, send full lessons with videos
      return res.status(200).json({
        lessons: allLessons.map(withSignedVideoUrl),
        isEnrolled: true,
      });
    }

    // 4. مسجل دخول بس مش مشترك — نفس الفهرس + دروس المعاينة المجانية
    return res
      .status(200)
      .json({ lessons: previewableLessons, isEnrolled: false });
  } catch (err) {
    console.error("CRITICAL SERVER ERROR:", err.message);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ⚠️ endpoint الاشتراك المجاني القديم (fakeEnrollCourse) اتشال نهائيًا —
// التسجيل في الكورس بقى بيحصل بس من paymentController.js بعد التحقق من HMAC
// الجاي من Paymob، عشان محدش يقدر يشترك من غير دفع فعلي.

// delete lesson
export const deleteLesson = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedLesson = await Lesson.findByIdAndDelete(id);

    // بنمسح الفيديو من Bunny كمان عشان منسيبش فيديوهات يتيمة بتاكل تخزين وفلوس
    if (deletedLesson?.videoUrl) {
      await deleteBunnyVideo(deletedLesson.videoUrl).catch((bunnyErr) =>
        console.warn("⚠️ Failed to delete Bunny video:", bunnyErr.message),
      );
    }

    res.status(200).json({
      deletedLesson,
      message: "lesson has been deleted",
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server Error", error: error.message });
  }
};

// update lesson
export const updateLesson = async (req, res) => {
  try {
    const { id } = req.params;
    const updatedLesson = await Lesson.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });
    res.status(200).json({
      updatedLesson,
      message: "lesson has been updated",
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server Error", error: error.message });
  }
};
