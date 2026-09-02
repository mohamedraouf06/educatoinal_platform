import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = "https://educatoinal-platform.onrender.com";

// اختبار حمل تصاعدي: يبدأ بـ 50 مستخدم متزامن، يزوّد تدريجي لـ 300 —
// نفس الاختبار اللي عملناه محليًا، بس على السيرفر الحقيقي على Render
export const options = {
  stages: [
    { duration: "10s", target: 50 },
    { duration: "10s", target: 100 },
    { duration: "10s", target: 300 },
    { duration: "10s", target: 0 },
  ],
};

// ⚠️ لو السيرفر على خطة Free بتاعة Render، بينام بعد 15 دقيقة من غير نشاط،
// وأول طلب بعد النوم بياخد 30-60+ ثانية للاستيقاظ. الـ setup() ده بيبعت طلب
// واحد "تسخين" قبل ما مراحل الحمل الفعلية تبدأ، عشان وقت الاستيقاظ ميتحسبش
// غلط كأنه جزء من أداء السيرفر تحت الضغط.
export function setup() {
  console.log("Warming up the server (in case it was asleep on Render free tier)...");
  const res = http.get(`${BASE_URL}/api/courses/all`);
  console.log(`Warm-up request status: ${res.status}, took ${res.timings.duration}ms`);
}

export default function () {
  const res = http.get(`${BASE_URL}/api/courses/all`);
  check(res, { "status is 200": (r) => r.status === 200 });
  sleep(0.1);
}
