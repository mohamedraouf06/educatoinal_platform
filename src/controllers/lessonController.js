import jwt from "jsonwebtoken";
import { Lesson, User } from "../models/models.js";
import {
  createBunnyVideo,
  uploadVideoToBunny,
  deleteBunnyVideo,
  withSignedVideoUrl,
  getBunnyVideoStatus,
  getBunnyVideoInfo,
} from "../utils/bunnyStream.js";
import { cacheGet, cacheSet, cacheDelPattern } from "../utils/redisClient.js";

const JWT_SECRET = process.env.JWT_SECRET;

// بيحاول يفك التوكن لو موجود، من غير ما يرفض الطلب لو مفيش توكن أو كان غلط —
// بيعامل أي حالة فاشلة كـ "زائر عادي" بدل ما يمنعه، عشان دروس المعاينة تفضل متاحة للكل
function getOptionalUser(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ") || !JWT_SECRET) {
    return null;
  }
  try {
    return jwt.verify(authHeader.split(" ")[1], JWT_SECRET);
  } catch {
    return null;
  }
}

// لأي درس لسه متسجّل عندنا كـ "processing"، بنسأل Bunny لايف هل خلص ولا لسه —
// ولو خلص، بنحدّث نسخته في الداتابيز فورًا عشان المرة الجاية نبقى عارفين من غير
// ما نسأل Bunny تاني. الدروس اللي أصلاً "ready" مش بتتلمس خالص (صفر تكلفة إضافية).
async function refreshProcessingLessons(lessons) {
  await Promise.all(
    lessons.map(async (lesson) => {
      if (lesson.status === "ready") return;
      try {
        const liveStatus = await getBunnyVideoStatus(lesson.videoUrl);
        if (liveStatus !== lesson.status) {
          lesson.status = liveStatus;
          await Lesson.updateOne({ _id: lesson._id }, { status: liveStatus });
        }
      } catch (err) {
        // فشل السؤال عن الحالة (Bunny مش متظبط، أو مشكلة شبكة مؤقتة) — نسيب
        // الدرس بحالته القديمة المخزّنة، ده أأمن من ما نكسر الـ endpoint كله
        console.warn(
          `⚠️ Could not refresh Bunny status for lesson ${lesson._id}:`,
          err.message,
        );
      }
    }),
  );
  return lessons;
}

// create a new lesson (admin only)
export const createLesson = async (req, res) => {
  try {
    const { title, courseId, duration, isFreePreview, order } = req.body;

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

    //  this will create a new video in Bunny Stream and return its videoId
    const videoId = await createBunnyVideo(title);
    // log the videoId for debugging purposes
    console.log(`Created new Bunny video with ID: ${videoId}`); //

    // 3. Upload the video file to Bunny Stream using the videoId
    await uploadVideoToBunny(videoId, req.file.buffer);
    // log the upload completion for debugging purposes
    console.log(`Uploaded video for lesson "${title}" to Bunny Stream.`); //
    // 4. Create the lesson in MongoDB
    const newLesson = new Lesson({
      title,
      videoUrl: videoId,
      courseId,
      duration: duration ? Number(duration) : 0,
      isFreePreview: isFreePreview === "true" || isFreePreview === true,
      order: order ? Number(order) : 0,
    });

    await newLesson.save();
    // 5. Clear the cache for this course's lessons preview, so next request will fetch fresh data
    await cacheDelPattern(`lessons:preview:${courseId}`);

    res
      .status(201)
      .json({ message: "Lesson created successfully!", lesson: newLesson });
  } catch (err) {
    console.error("❌ BUNNY UPLOAD CRASH:", err);
    res.status(500).json({
      message: "Server error while creating lesson",
      error: err.message,
    });
  }
};

export const getLessonsByCourse = async (req, res) => {
  try {
    const { courseId } = req.params;

    // بنحاول نفك التوكن لو موجود، من غير ما نمنع الزائر اللي مفيش عنده توكن أصلاً
    const decoded = getOptionalUser(req);
    const userId = decoded?.userId;
    const userRole = decoded?.role;

    // ⚠️ الكاش هنا مقصور على نسخة "المعاينة المجانية" بس (زائر / مسجّل مش مشترك) —
    // دي النسخة الوحيدة اللي بتكون *مطابقة لأي حد* بغض النظر عن هويته، فآمن تتشارك.
    // نسخة الأدمن ونسخة الطالب المشترك فيهم روابط فيديو موقّعة لمحتوى مدفوع خاص بكل
    // مستخدم — لو اتحطوا في نفس الكاش المشترك، أي زائر تاني ممكن ياخد وصول لمحتوى
    // مش من حقه (نفس نوع الثغرة اللي اتصلحت قبل كده في studentController.js).
    // عشان كده الفرعين دول بيتحسبوا live في كل مرة، من غير كاش خالص.
    const previewCacheKey = `lessons:preview:${courseId}`;
    const isPrivilegedRequest = userRole === "admin" || !!userId;

    if (!isPrivilegedRequest) {
      const cached = await cacheGet(previewCacheKey);
      if (cached) {
        return res.status(200).json(cached);
      }
    }

    // 1. الفهرس العام: كل الدروس بعناوينها، وأي درس معاينة مجانية بيتبعت برابط فيديو فعلي وموقّع
    let allLessons = await Lesson.find({ courseId }).sort({ order: 1 }).lean();

    // 2. أدمن: وصول كامل لكل الدروس **بكل حالاتها** (بما فيها لسه "processing")،
    // مع حالة كل درس ظاهرة، عشان يعرف إيه اللي جاهز وإيه لسه بيتعالج — من غير كاش
    if (userRole === "admin") {
      allLessons = await refreshProcessingLessons(allLessons);
      return res.status(200).json({
        lessons: allLessons.map(withSignedVideoUrl),
        isEnrolled: true,
      });
    }

    // ⚠️ من هنا وتحت (كل الجمهور غير الأدمن)، أي درس لسه "processing" أو "error"
    // بيتشال تمامًا من القايمة — طالب دافع فلوس (أو زائر) محدش يشوفله "Processing"
    // في نص تجربته، الدرس ببساطة مش موجود لحد ما يخلص فعليًا
    allLessons = await refreshProcessingLessons(allLessons);
    const readyLessons = allLessons.filter((l) => l.status === "ready");

    const previewableLessons = readyLessons.map((lesson) =>
      lesson.isFreePreview
        ? withSignedVideoUrl(lesson)
        : { ...lesson, videoUrl: undefined },
    );
    const previewPayload = { lessons: previewableLessons, isEnrolled: false };

    // 3. زائر مش مسجل دخول خالص — بيشوف الفهرس + دروس المعاينة المجانية بس
    if (!userId) {
      // 60 ثانية كفاية، وأقل بكتير من صلاحية التوكن الموقّع نفسه (ساعة كاملة)
      await cacheSet(previewCacheKey, previewPayload, 60);
      return res.status(200).json(previewPayload);
    }

    // بنجيب بس enrolledCourses، ده الحقل الوحيد المستخدم هنا
    const user = await User.findById(userId).select("enrolledCourses");

    // لو التوكن بتاع مستخدم اتمسح من الداتابيز، بنعامله زي الزائر مش بنرفض الطلب
    if (!user) {
      return res.status(200).json(previewPayload);
    }

    // English comment: Verify if the student has access to this course
    const hasAccess =
      user.enrolledCourses && user.enrolledCourses.includes(courseId);

    if (hasAccess) {
      // If enrolled, send full READY lessons with videos — من غير كاش، ده محتوى مدفوع خاص
      return res.status(200).json({
        lessons: readyLessons.map(withSignedVideoUrl),
        isEnrolled: true,
      });
    }

    // 4. مسجل دخول بس مش مشترك — نفس الفهرس + دروس المعاينة المجانية
    return res.status(200).json(previewPayload);
  } catch (err) {
    console.error("CRITICAL SERVER ERROR:", err.message);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ⚠️ endpoint الاشتراك المجاني القديم (fakeEnrollCourse) اتشال نهائيًا —
// التسجيل في الكورس بقى بيحصل بس من paymentController.js بعد التحقق من HMAC
// الجاي من Paymob، عشان محدش يقدر يشترك من غير دفع فعلي.

// delete lesson
export const deleteLesson = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedLesson = await Lesson.findByIdAndDelete(id);

    // بنمسح الفيديو من Bunny كمان عشان منسيبش فيديوهات يتيمة بتاكل تخزين وفلوس
    if (deletedLesson?.videoUrl) {
      await deleteBunnyVideo(deletedLesson.videoUrl).catch((bunnyErr) =>
        console.warn("⚠️ Failed to delete Bunny video:", bunnyErr.message),
      );
    }

    if (deletedLesson?.courseId) {
      await cacheDelPattern(`lessons:preview:${deletedLesson.courseId}`);
    }

    res.status(200).json({
      deletedLesson,
      message: "lesson has been deleted",
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server Error", error: error.message });
  }
};

// update lesson
export const updateLesson = async (req, res) => {
  try {
    const { id } = req.params;
    const updatedLesson = await Lesson.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });

    if (updatedLesson?.courseId) {
      await cacheDelPattern(`lessons:preview:${updatedLesson.courseId}`);
    }

    res.status(200).json({
      updatedLesson,
      message: "lesson has been updated",
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server Error", error: error.message });
  }
};

// بيرجّع حالة درس واحد + نسبة تقدّم التحويل الفعلية من Bunny (0-100) — الأدمن بس،
// مخصّصة عشان الفرونت إند يعمل عليها Polling ويوري شريط تقدّم حقيقي بعد رفع
// الفيديو مباشرة، لحد ما الحالة تبقى "ready"
export const getLessonProcessingStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const lesson = await Lesson.findById(id).select("status videoUrl");

    if (!lesson) {
      return res.status(404).json({ message: "Lesson not found" });
    }

    // الدرس أصلاً جاهز — مفيش داعي نسأل Bunny تاني، صفر تكلفة إضافية
    if (lesson.status === "ready") {
      return res.status(200).json({ status: "ready", encodeProgress: 100 });
    }

    const info = await getBunnyVideoInfo(lesson.videoUrl);
    if (info.status !== lesson.status) {
      lesson.status = info.status;
      await lesson.save();
    }

    return res.status(200).json(info);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
