import { Course, User } from "../models/models.js";
import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";
import path from "path";

// Force load the environment variables
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

// Cloudinary Configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const createCourse = async (req, res) => {
  try {
    const {
      title,
      description,
      price,
      category,
      instructorName,
      instructorBio,
      whatYouWillLearn, // نص متعدد الأسطر جاي من الفرونت، كل سطر نقطة
      relatedCourses, // IDs مفصولة بفاصلة
    } = req.body;

    // Standard fallback URL
    let thumbnailUrl = `https://via.placeholder.com/300x200.png?text=${encodeURIComponent(title)}`;

    // Process file buffer if available
    if (req.file) {
      console.log("Converting file buffer to base64...");
      const fileBase64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;

      console.log("Triggering Cloudinary upload API...");

      // Execute upload synchronously to capture response or failure
      const uploadResponse = await cloudinary.uploader.upload(fileBase64, {
        folder: "course_thumbnails",
        resource_type: "image",
      });

      // Override the fallback with Cloudinary secure URL
      thumbnailUrl = uploadResponse.secure_url;
    } else {
      console.log("⚠️ No file found in req.file. Using placeholder instead.");
    }

    // 1. Create instance with the parsed thumbnail URL
    const newCourse = new Course({
      title,
      description,
      price: Number(price),
      category: category,
      thumbnail: thumbnailUrl,
      instructorName: instructorName || undefined,
      instructorBio: instructorBio || undefined,
      whatYouWillLearn: whatYouWillLearn
        ? whatYouWillLearn
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean)
        : [],
      relatedCourses: relatedCourses
        ? relatedCourses
            .split(",")
            .map((id) => id.trim())
            .filter(Boolean)
        : [],
    });

    // 2. Save document to MongoDB atlas
    await newCourse.save();
    // 3. Dispatch final success payload
    return res.status(201).json({
      message: "Course created successfully!",
      course: newCourse,
    });
  } catch (error) {
    // 🔍 DEBUG LOG: Catch if Cloudinary fails during the execution block
    console.error("❌ CRITICAL ERROR IN CREATE_COURSE BLOCK:", error);
    return res
      .status(500)
      .json({ message: "Server Error", error: error.message });
  }
};

export const getAllCourses = async (req, res) => {
  try {
    // Pagination: لو مفيش page/limit في الطلب، بنرجع أول 50 كورس بس —
    // مش كل الكتالوج دفعة واحدة، عشان الصفحة تفضل سريعة مهما كبر عدد الكورسات
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const skip = (page - 1) * limit;

    const [courses, total] = await Promise.all([
      Course.find().skip(skip).limit(limit).lean(),
      Course.countDocuments(),
    ]);

    return res.status(200).json({
      courses,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server Error", error: error.message });
  }
};

// جلب كورس واحد بتفاصيله الكاملة (عام، أي زائر يقدر يشوفه) — لصفحة تفاصيل الكورس
export const getCourseById = async (req, res) => {
  try {
    const { id } = req.params;

    const [course, enrolledCount] = await Promise.all([
      Course.findById(id)
        .populate("relatedCourses", "title thumbnail price")
        .lean(),
      // إثبات اجتماعي: عدد الطلاب المشتركين فعليًا في الكورس ده
      User.countDocuments({ enrolledCourses: id }),
    ]);

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    return res.status(200).json({ course: { ...course, enrolledCount } });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server Error", error: error.message });
  }
};

// delete Course
export const deleteCourse = async (req, res) => {
  try {
    const { id } = req.params;
    console.log("Iiiiiiiiiiiiiiiiid", id);
    const deletedCourse = await Course.findByIdAndDelete(id);
    res.status(200).json({
      deletedCourse,
      message: "course has been deleted",
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server Error", error: error.message });
  }
};

export const updateCourse = async (req, res) => {
  try {
    const { id } = req.params;
    const updatedCourse = await Course.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });
    res.status(200).json({
      updatedCourse,
      message: "course has been updated",
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server Error", error: error.message });
  }
};
