import { Lesson } from "../models/models";
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
export const getLessonsBycourse = async (req, res) => {
  try {
    const { courseId } = req.body;
    const lessons = await Lesson.find({ courseId });
  } catch (err) {
    res.status(500).json({
      message: "Server error while creating lesson",
      error: err.message,
    });
  }
};
