import mongoose from "mongoose";

const progressSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
    },
    completedLessons: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Lesson",
      },
    ],
    lastAccessedLesson: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lesson",
    },
  },
  { timestamps: true },
);

// منع تكرار إنشاء أكثر من سجل لنفس الطالب ونفس الكورس
progressSchema.index({ userId: 1, courseId: 1 }, { unique: true });

const Progress = mongoose.model("Progress", progressSchema);
export default Progress;
