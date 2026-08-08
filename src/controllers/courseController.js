import { Course } from "../models/models.js";
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
    const { title, description, price, category } = req.body;

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
    const courses = await Course.find();
    return res.status(200).json({ courses });
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
