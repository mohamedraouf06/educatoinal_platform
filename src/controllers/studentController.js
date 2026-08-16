import { User, Course } from "../models/models.js";
import Progress from "../models/Progress.js";
import { withSignedVideoUrl } from "../utils/bunnyStream.js";

export const getMyCourses = async (req, res) => {
  try {
    const { userId } = req.user;
    // Populate enrolled courses using the user ID attached by auth middleware
    const user = await User.findById(userId)
      .populate({
        path: "enrolledCourses",
        select:
          "title description thumbnail price instructorName instructorBio relatedCourses",
        populate: [
          { path: "lessons", select: "title duration isFreePreview order" },
          { path: "relatedCourses", select: "title thumbnail price" },
        ],
      })
      .lean();

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const enrolledCourses = user.enrolledCourses || [];
    const courseIds = enrolledCourses.map((c) => c._id);

    // بنجيب تقدم الطالب في كل الكورسات المشترك فيها بطلب واحد، مش طلب لكل كورس لوحده
    const progressRecords = await Progress.find({
      userId,
      courseId: { $in: courseIds },
    })
      .select("courseId completedLessons")
      .lean();

    const completedCountByCourse = new Map(
      progressRecords.map((p) => [
        p.courseId.toString(),
        p.completedLessons.length,
      ]),
    );

    // نسبة الإنجاز لكل كورس — تستخدمها صفحة "My Learning" تحفّز الطالب يكمل
    const coursesWithProgress = enrolledCourses.map((course) => {
      const totalLessons = course.lessons?.length || 0;
      const completedCount = completedCountByCourse.get(course._id.toString()) || 0;
      return {
        ...course,
        progressPercent:
          totalLessons > 0
            ? Math.round((completedCount / totalLessons) * 100)
            : 0,
      };
    });

    res.status(200).json({
      success: true,
      count: coursesWithProgress.length,
      data: coursesWithProgress,
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
  const { userId } = req.user;
  try {
    const { courseId } = req.params;
    // بنجيب بس role و enrolledCourses، دول الحقلين المستخدمين هنا
    const user = await User.findById(userId).select("role enrolledCourses");

    // Verify if the student is actually enrolled in this course or has admin role
    const isEnrolled = user.enrolledCourses.includes(courseId);
    if (!isEnrolled && user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. You are not enrolled in this course.",
      });
    }

    // ⚠️ ملحوظة: مبنحطش .lean() على استعلام الـ user فوق عشان محتاجين
    // enrolledCourses.includes() تفضل شغالة كـ MongooseArray الأصلي
    const course = await Course.findById(courseId)
      .populate("lessons")
      .lean();

    if (!course) {
      return res
        .status(404)
        .json({ success: false, message: "Course not found" });
    }

    // ⚠️ ده كان أكبر ثغرة فعلية: الدروس هنا كانت بترجع videoUrl الخام من غير
    // توقيع أو حماية — أي طالب مشترك كان يقدر ياخد الرابط الدائم ويشاركه.
    // لازم كل مكان بيرجّع دروس لمستخدم يعدّي عليها بالدالة دي، مش يرجّعها خام.
    const course_ = {
      ...course,
      lessons: (course.lessons || []).map(withSignedVideoUrl),
    };

    res.status(200).json({
      success: true,
      data: course_,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};
