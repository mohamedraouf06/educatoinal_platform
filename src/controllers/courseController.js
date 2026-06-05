// controllers/courseController.js
import { Course } from "../models/models.js";

export const createCourse = async (req, res) => {
  console.log("Received course creation request with data:", req.body);

  try {
    const { title, description, price, category } = req.body;

    // 1. Create instance
    const newCourse = new Course({
      title,
      description,
      price,
      thumbnail: `https://via.placeholder.com/300x200.png?text=${encodeURIComponent(title)}`, // Placeholder thumbnail with course title
    });

    // 2. Save to database
    await newCourse.save();

    // 3. 🔥 Added 'return' to stop execution immediately after sending response
    return res.status(201).json({
      message: "Course created successfully!",
      course: newCourse,
    });
  } catch (error) {
    // 🔥 Added 'return' here as well to prevent any double response bugs
    return res
      .status(500)
      .json({ message: "Server Error", error: error.message });
  }
};
