import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = "https://educatoinal-platform.onrender.com";

// حسابات اختبار ثابتة (5 بس) بيتسجّلوا مرة واحدة في setup() ويتعاد استخدامهم —
// عشان الاختبار ميضيفش آلاف اليوزرز الوهميين في قاعدة البيانات الحقيقية في كل تشغيلة
const TEST_ACCOUNTS = Array.from({ length: 5 }, (_, i) => ({
  name: `k6 Load Test ${i}`,
  email: `k6.loadtest.${i}@example.com`,
  password: "LoadTest123!",
}));

export const options = {
  stages: [
    { duration: "10s", target: 50 },
    { duration: "10s", target: 100 },
    { duration: "10s", target: 300 },
    { duration: "10s", target: 0 },
  ],
};

// ⚠️ تسجيل الدخول بيحصل هنا بس، مرة واحدة لكل حساب من الـ 5 — مش جوه الرحلة نفسها.
// السبب: authLimiter بتاعك (10 محاولات/15 دقيقة لكل IP) بيحسب كل الـ 300 VU كأنهم
// نفس الزائر لأنهم شغالين من نفس الجهاز. لو كل VU حاول يسجّل دخول بنفسه، 99% من
// المحاولات هترفض بـ 429 — مش عيب أداء، دي الحماية شغالة صح. الحل الواقعي: نسجّل
// دخول مرة واحدة بس (زي طالب حقيقي)، وكل الـ VUs يشاركوا نفس التوكنات في تصفّحهم.
export function setup() {
  console.log("Warming up server + logging in test accounts once...");
  http.get(`${BASE_URL}/api/courses/all`); // تسخين لو السيرفر نايم (Render Free)

  const tokens = [];
  TEST_ACCOUNTS.forEach((acc) => {
    // لو الحساب مش موجود لسه، سجّله (لو موجود من تشغيلة سابقة هيرجع 400 ومتجاهلينه)
    http.post(`${BASE_URL}/api/auth/register`, JSON.stringify(acc), {
      headers: { "Content-Type": "application/json" },
    });

    const loginRes = http.post(
      `${BASE_URL}/api/auth/login`,
      JSON.stringify({ email: acc.email, password: acc.password }),
      { headers: { "Content-Type": "application/json" } },
    );

    try {
      tokens.push(loginRes.json("token") || null);
    } catch {
      tokens.push(null);
    }
  });

  console.log(`Logged in ${tokens.filter(Boolean).length} / ${TEST_ACCOUNTS.length} test accounts.`);
  return { tokens };
}

// رحلة طالب واقعية: يبقى مسجّل دخول أصلاً -> يتصفّح الكتالوج -> يفتح كورس -> يشوف الدروس -> يشوف "My Learning"
export default function (data) {
  const token = data.tokens[__VU % data.tokens.length];
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  // 1) تصفّح كتالوج الكورسات — عليه كاش
  const catalogRes = http.get(`${BASE_URL}/api/courses/all`, {
    tags: { name: "1_catalog_cached" },
  });
  check(catalogRes, { "catalog: status 200": (r) => r.status === 200 });

  let courseId = null;
  try {
    const courses = catalogRes.json("courses");
    if (courses && courses.length > 0) {
      courseId = courses[Math.floor(Math.random() * courses.length)]._id;
    }
  } catch {
    // مفيش كورسات أو رد غير متوقّع — الرحلة بتكمل من غير الخطوات المعتمدة على courseId
  }

  sleep(0.3);

  if (courseId) {
    // 2) فتح تفاصيل كورس معيّن — عليه كاش
    const detailRes = http.get(`${BASE_URL}/api/courses/${courseId}`, {
      tags: { name: "2_course_detail_cached" },
    });
    check(detailRes, { "detail: status 200": (r) => r.status === 200 });

    sleep(0.2);

    // 3) يشوف دروس الكورس — كاش جزئي (نسخة المعاينة المجانية لو مش مشترك)
    const lessonsRes = http.get(`${BASE_URL}/api/lessons/course/${courseId}`, {
      headers: authHeaders,
      tags: { name: "3_lessons_partial_cache" },
    });
    check(lessonsRes, { "lessons: status 200": (r) => r.status === 200 });
  }

  sleep(0.3);

  // 4) لوحة "My Learning" — بيانات شخصية خاصة بكل طالب، من غير كاش عمدًا
  if (token) {
    const myCoursesRes = http.get(`${BASE_URL}/api/student/my-courses`, {
      headers: authHeaders,
      tags: { name: "4_my_courses_uncached" },
    });
    check(myCoursesRes, { "my-courses: status 200": (r) => r.status === 200 });
  }

  sleep(0.5);
}
