import { Lesson } from "../models/models.js";

// create a new lesson (admin only)
export const createLesson = async (req, res) => {
  try {
    const { title, videoUrl, courseId } = req.body;

    // Validation: Ensure all required fields are present
    if (!title || !videoUrl || !courseId) {
      return res.status(400).json({
        message: "Please provide title, videoUrl, and courseId for the lesson.",
      });
    }
    const newLesson = new Lesson({
      title,
      videoUrl,
      courseId,
    });
    await newLesson.save();
    res
      .status(201)
      .json({ message: "Lesson created successfully!", lesson: newLesson });
  } catch (err) {
    res.status(500).json({
      message: "Server error while creating lesson",
      error: err.message,
    });
  }
};

// get all lessons for a specific course (students and admins)
export const getLessonsByCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const user = await User.findById(req.user.id); // Get the logged-in user's data from the database
    const userRole = req.user.role; // Assuming authMiddleware adds user info to req.user
    if (userRole === "admin") {
      const lessons = await Lesson.find({ courseId });
      return res.status(200).json({ lessons });
    }
    if (!user.enrolledCourses.includes(courseId)) {
      return res.status(403).json({
        message: "You must purchase this course to access its lessons.",
      });
    } else if (user.enrolledCourses.includes(courseId)) {
      const lessons = await Lesson.find({ courseId });
      return res.status(200).json({ lessons });
    }
  } catch (err) {
    res.status(500).json({
      message: "Server error while fetching lessons",
      error: err.message,
    });
  }
};
