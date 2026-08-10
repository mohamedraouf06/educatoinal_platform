import { User, Course } from "../models/models.js";

export const getMyCourses = async (req, res) => {
  try {
    console.log("req from getmycourses", req.user);
    const { userId } = req.user;
    // // Populate enrolled courses using the user ID attached by auth middleware
    const user = await User.findById(userId).populate({
      path: "enrolledCourses",
      select: "title description thumbnail instructor progress",
      populate: {
        path: "lessons",
        select: "title duration videoUrl freePreview order",
      },
    });

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    res.status(200).json({
      success: true,
      count: user.enrolledCourses ? user.enrolledCourses.length : 0,
      data: user.enrolledCourses,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

export const getCourseDetailsForStudent = async (req, res) => {
  console.log("from courses data ", req.user);
  const { userId } = req.user;
  try {
    const { courseId } = req.params;
    const user = await User.findById(userId);

    // Verify if the student is actually enrolled in this course or has admin role
    const isEnrolled = user.enrolledCourses.includes(courseId);
    if (!isEnrolled && user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. You are not enrolled in this course.",
      });
    }

    const course = await Course.findById(courseId).populate("lessons");

    if (!course) {
      return res
        .status(404)
        .json({ success: false, message: "Course not found" });
    }

    res.status(200).json({
      success: true,
      data: course,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};
