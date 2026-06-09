import mongoose from "mongoose";
import { Lesson, User } from "../models/models.js";

// create a new lesson (admin only)
import { v2 as cloudinary } from "cloudinary"; // 👈 تأكد إنك عامل import لـ cloudinary فوق في الملف
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});
export const createLesson = async (req, res) => {
  try {
    const { title, courseId } = req.body;

    // 🎯 انقل الـ Config هنا جوه الـ try عشان تضمن إن الـ process.env مقروءة وجاهزة بالملّي وقت الرفع
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });

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

    // 3. Upload Stream
    const uploadToCloudinary = () => {
      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            resource_type: "video",
            folder: "course_lessons",
          },
          (error, result) => {
            if (error) return reject(error);
            resolve(result);
          },
        );
        stream.end(req.file.buffer);
      });
    };

    const cloudinaryResult = await uploadToCloudinary();

    const newLesson = new Lesson({
      title,
      videoUrl: cloudinaryResult.secure_url,
      courseId,
    });

    await newLesson.save();

    res
      .status(201)
      .json({ message: "Lesson created successfully!", lesson: newLesson });
  } catch (err) {
    console.error("❌ CLOUDINARY UPLOAD CRASH:", err);
    res.status(500).json({
      message: "Server error while creating lesson",
      error: err.message,
    });
  }
};
// Node.js implementation updates to imports instead of require as per standards
export const getLessonsByCourse = async (req, res) => {
  try {
    const { courseId } = req.params;

    // English comment: Use userId as defined by the authMiddleware payload
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    // 1. Fetch all lessons for this course, but exclude the video URLs by default
    const lessonsIndex = await Lesson.find({ courseId }).select("-videoUrl");

    // 2. If user is admin, they get full access including video URLs
    if (userRole === "admin") {
      const fullLessons = await Lesson.find({ courseId });
      return res.status(200).json({ lessons: fullLessons, isEnrolled: true });
    }

    // 3. For students, check if they are enrolled
    if (!userId) {
      return res
        .status(401)
        .json({ message: "User ID missing from token status" });
    }

    // English comment: Fetch user profile using the correct userId property
    const user = await User.findById(userId);

    if (!user) {
      return res
        .status(404)
        .json({ message: "Student profile not found in database" });
    }

    // English comment: Verify if the student has access to this course
    const hasAccess =
      user.enrolledCourses && user.enrolledCourses.includes(courseId);
    console.log("hasAccessssssssssssssssssssssssssssssss", hasAccess);

    if (hasAccess) {
      // If enrolled, send full lessons with videos
      const fullLessons = await Lesson.find({ courseId });
      return res.status(200).json({ lessons: fullLessons, isEnrolled: true });
    }

    // 4. If not enrolled, send only the index (titles only) and flag them as locked
    return res.status(200).json({ lessons: lessonsIndex, isEnrolled: false });
  } catch (err) {
    console.error("CRITICAL SERVER ERROR:", err.message);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Fake payment endpoint to enroll a student into a course
export const fakeEnrollCourse = async (req, res) => {
  try {
    const { courseId } = req.body;
    const userId = req.user?.userId; // Captured from authMiddleware
    const lessons = await Lesson.find({ courseId: courseId });
    if (!courseId) {
      return res.status(400).json({ message: "Course ID is required" });
    }

    // Find the student in the database
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if already enrolled to avoid duplicates
    if (user.enrolledCourses.includes(courseId)) {
      return res
        .status(400)
        .json({ message: "You are already enrolled in this course" });
    }

    // Push the courseId into the student's enrollment array
    user.enrolledCourses.push(courseId);
    await user.save();

    return res.status(200).json({
      lessons: lessons,
      status: "success",
      message: "Payment successful! Course added to your account.",
      enrolledCourses: [user.enrolledCourses],
    });
  } catch (err) {
    console.error("Enrollment error:", err);
    return res.status(500).json({ message: "Server error during enrollment" });
  }
};
