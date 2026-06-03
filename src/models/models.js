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
});

// ==========================================
// 2. COURSE SCHEMA (The Big Umbrella)
// ==========================================
const courseSchema = new mongoose.Schema({
  title: { type: String, required: true }, // e.g., "Node.js BootCamp"
  description: { type: String },
  price: { type: Number, required: true },
  thumbnail: { type: String }, // URL of the course cover image
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
  videoUrl: { type: String, required: true }, // Secret video URL coming from Cloudinary cloud storage
});

// Convert Schemas into usable Mongoose Models
export const User = mongoose.model("User", userSchema);
export const Course = mongoose.model("Course", courseSchema);
export const Lesson = mongoose.model("Lesson", lessonSchema);
