// ⚠️ لازم يتحمّل هنا بالذات (أول سطر): lessonController.js بيعمل import للملف ده،
// وكل الـ imports بتتقيّم قبل ما جسم server.js (ومنه dotenv.config() بتاعه) يشتغل —
// فمن غير السطر ده، المفاتيح تحت كانت هتفضل undefined دايمًا وقت التشغيل الحقيقي،
// حتى لو .env مظبوط صح 100%. (نفس الباگ اللي اتصلح قبل كده في authController.js)
import "dotenv/config";
import { createHash } from "node:crypto";

// المفاتيح دي بتتقرا من .env — لو لسه ما ضفتهاش (زي دلوقتي قبل ما تشتري Bunny)
// أي محاولة رفع/تشغيل فيديو هترجع خطأ واضح بدل ما تكسر السيرفر كله
const BUNNY_STREAM_LIBRARY_ID = process.env.BUNNY_STREAM_LIBRARY_ID;
const BUNNY_STREAM_API_KEY = process.env.BUNNY_STREAM_API_KEY;
const BUNNY_STREAM_TOKEN_AUTH_KEY = process.env.BUNNY_STREAM_TOKEN_AUTH_KEY;

const BUNNY_API_BASE = "https://video.bunnycdn.com/library";

function assertBunnyConfigured() {
  if (!BUNNY_STREAM_LIBRARY_ID || !BUNNY_STREAM_API_KEY) {
    throw new Error(
      "Bunny Stream is not configured. Please set BUNNY_STREAM_LIBRARY_ID and BUNNY_STREAM_API_KEY in .env",
    );
  }
}

// 1) بينشئ سجل "فيديو" فاضي جوه مكتبة Bunny ويرجع الـ videoId (guid) بتاعه
export async function createBunnyVideo(title) {
  assertBunnyConfigured();

  const res = await fetch(
    `${BUNNY_API_BASE}/${BUNNY_STREAM_LIBRARY_ID}/videos`,
    {
      method: "POST",
      headers: {
        AccessKey: BUNNY_STREAM_API_KEY,
        "Content-Type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({ title }),
    },
  );

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Bunny createVideo failed (${res.status}): ${errorBody}`);
  }

  const data = await res.json();
  return data.guid; // ده الـ videoId اللي هنخزنه في الداتابيز بدل الرابط الكامل
}

// 2) بيرفع محتوى الفيديو (binary buffer) على الفيديو اللي اتعمل بالخطوة اللي فوق
export async function uploadVideoToBunny(videoId, fileBuffer) {
  assertBunnyConfigured();

  const res = await fetch(
    `${BUNNY_API_BASE}/${BUNNY_STREAM_LIBRARY_ID}/videos/${videoId}`,
    {
      method: "PUT",
      headers: {
        AccessKey: BUNNY_STREAM_API_KEY,
        "Content-Type": "application/octet-stream",
      },
      body: fileBuffer,
    },
  );

  if (!res.ok) {
    const errorBody = await res.text();
    // لو الرفع فشل بعد ما اتعمل سجل الفيديو، بنمسح السجل الفاضي ده عشان منسيبوش يتيم في حساب Bunny
    await deleteBunnyVideo(videoId).catch(() => {});
    throw new Error(`Bunny uploadVideo failed (${res.status}): ${errorBody}`);
  }

  return true;
}

// 3) بيمسح الفيديو من Bunny (بنستخدمها لما نمسح الدرس من الداتابيز عشان منسيبش فيديوهات يتيمة بتاكل تخزين وفلوس)
export async function deleteBunnyVideo(videoId) {
  assertBunnyConfigured();

  const res = await fetch(
    `${BUNNY_API_BASE}/${BUNNY_STREAM_LIBRARY_ID}/videos/${videoId}`,
    {
      method: "DELETE",
      headers: { AccessKey: BUNNY_STREAM_API_KEY },
    },
  );

  if (!res.ok) {
    console.warn(
      `⚠️ Bunny deleteVideo returned ${res.status} for video ${videoId}`,
    );
  }
}

// 3.5) بيسأل Bunny عن حالة الفيديو الحالية (لسه بيتعالج / جاهز / فشل) + نسبة
// تقدّم التحويل الفعلية (encodeProgress، رقم من 0 لـ 100). أكواد الحالة الرسمية
// (VideoModel.status): 0=Created 1=Uploaded 2=Processing 3=Transcoding
// 4=Finished(جاهز للتشغيل) 5=Error 6=UploadFailed 7/8=JIT stages
// https://docs.bunny.net/reference/video_getvideo
export async function getBunnyVideoInfo(videoId) {
  assertBunnyConfigured();

  const res = await fetch(`${BUNNY_API_BASE}/${BUNNY_STREAM_LIBRARY_ID}/videos/${videoId}`, {
    method: "GET",
    headers: { AccessKey: BUNNY_STREAM_API_KEY, accept: "application/json" },
  });

  if (!res.ok) {
    throw new Error(`Bunny getVideo failed (${res.status})`);
  }

  const data = await res.json();
  let status = "processing";
  if (data.status === 4) status = "ready";
  else if (data.status === 5 || data.status === 6) status = "error";

  return {
    status,
    encodeProgress: typeof data.encodeProgress === "number" ? data.encodeProgress : 0,
  };
}

// نسخة مبسّطة بترجع الحالة بس (نص) — مستخدمة في الأماكن اللي مش محتاجة النسبة
export async function getBunnyVideoStatus(videoId) {
  const { status } = await getBunnyVideoInfo(videoId);
  return status;
}

// 4) بيبني رابط تشغيل (iframe embed) موقّع بتوكن ومحدود الصلاحية للفيديو
// معتمد على النظام الرسمي لـ Bunny Stream "Embed View Token Authentication":
// https://docs.bunny.net/docs/stream-embed-view-token-authentication
// الصيغة: token = sha256_hex(authKey + videoId + expiresUnixTimestamp)
export function getSignedVideoUrl(videoId, expiresInSeconds = 3600) {
  if (!BUNNY_STREAM_LIBRARY_ID) {
    throw new Error("BUNNY_STREAM_LIBRARY_ID is not configured in .env");
  }

  // لو مفتاح الـ Token Authentication لسه مش متضاف في .env، بنرجع رابط عادي (مؤقتًا وقت الإعداد فقط)
  if (!BUNNY_STREAM_TOKEN_AUTH_KEY) {
    return `https://iframe.mediadelivery.net/embed/${BUNNY_STREAM_LIBRARY_ID}/${videoId}`;
  }

  const expires = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const hashableBase = `${BUNNY_STREAM_TOKEN_AUTH_KEY}${videoId}${expires}`;
  const token = createHash("sha256").update(hashableBase).digest("hex");

  return `https://iframe.mediadelivery.net/embed/${BUNNY_STREAM_LIBRARY_ID}/${videoId}?token=${token}&expires=${expires}`;
}

// ⚠️ حقل videoUrl في الداتابيز بيخزن Bunny videoId (مش رابط كامل). الرابط الفعلي
// القابل للتشغيل بيتبني ديناميك وموقّع بتوكن مؤقت وقت كل طلب، عشان الرابط ميفضلش
// شغال لأي حد للأبد. لازم كل مكان في الكود بيرجّع lesson لأي مستخدم يستخدم الدالة
// دي، مش يرجّع lesson.videoUrl الخام زي ما هو — وإلا الحماية كلها بتتلغى.
//
// لو Bunny لسه مش متظبط في .env، بنرجّع الدرس من غير videoUrl (null) بدل ما نكسر
// الـ endpoint كله بـ 500 — العنوان وحالة القفل/الفتح لسه بتشتغل عادي.
export function withSignedVideoUrl(lesson) {
  if (!lesson.videoUrl) return lesson;
  try {
    return {
      ...lesson,
      videoUrl: getSignedVideoUrl(lesson.videoUrl),
    };
  } catch (err) {
    console.warn(
      `⚠️ Could not build signed Bunny URL for lesson ${lesson._id}:`,
      err.message,
    );
    return { ...lesson, videoUrl: null };
  }
}
