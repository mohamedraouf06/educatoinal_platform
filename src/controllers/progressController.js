import Progress from "../models/Progress.js";

export const getCourseProgress = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?._id || req.user?.id;
    const { courseId } = req.params;

    let progress = await Progress.findOne({ userId, courseId })
      .populate("completedLessons", "title")
      .populate("lastAccessedLesson", "title videoUrl");

    // لو الطالب أول مرة يفتح الكورس، بننشئ له سجل جديد أوتوماتيك
    if (!progress) {
      progress = await Progress.create({
        userId,
        courseId,
        completedLessons: [],
      });
    }

    res.status(200).json({
      success: true,
      data: progress,
    });
  } catch (error) {
    console.error("❌ Error in getCourseProgress:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

export const toggleLessonCompletion = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?._id || req.user?.id;
    const { courseId, lessonId } = req.body; // 👈 استقبال الـ courseId والـ lessonId مباشرة

    if (!courseId || !lessonId) {
      return res.status(400).json({
        success: false,
        message: "Both courseId and lessonId are required",
      });
    }

    let progress = await Progress.findOne({ userId, courseId });

    if (!progress) {
      progress = new Progress({
        userId,
        courseId,
        completedLessons: [],
      });
    }

    const isCompleted = progress.completedLessons.includes(lessonId);

    if (isCompleted) {
      // إلغاء تحديد الدرس (Unmark)
      progress.completedLessons.pull(lessonId);
    } else {
      // إكمال الدرس (Mark as Completed)
      progress.completedLessons.push(lessonId);
    }

    // تحديث آخر درس وصل له الطالب
    progress.lastAccessedLesson = lessonId;

    await progress.save();

    res.status(200).json({
      success: true,
      message: isCompleted ? "Lesson unmarked" : "Lesson completed",
      completedLessons: progress.completedLessons,
      lastAccessedLesson: progress.lastAccessedLesson,
    });
  } catch (error) {
    console.error("❌ Error in toggleLessonCompletion:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

export const updateLastAccessed = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?._id || req.user?.id;
    const { courseId, lessonId } = req.body;

    if (!courseId || !lessonId) {
      return res.status(400).json({
        success: false,
        message: "Both courseId and lessonId are required",
      });
    }

    const progress = await Progress.findOneAndUpdate(
      { userId, courseId },
      { lastAccessedLesson: lessonId },
      { new: true, upsert: true },
    );

    res.status(200).json({
      success: true,
      data: progress,
    });
  } catch (error) {
    console.error("❌ Error in updateLastAccessed:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};
