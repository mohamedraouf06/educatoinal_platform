import http from "k6/http";
import { check, sleep } from "k6";

// اختبار حمل تصاعدي: يبدأ بـ 50 مستخدم متزامن، يزوّد تدريجي لـ 300
// نفس فلسفة اختبارات autocannon اللي عملناها قبل كده، بس بأداة k6
export const options = {
  stages: [
    { duration: "10s", target: 50 },
    { duration: "10s", target: 100 },
    { duration: "10s", target: 300 },
    { duration: "10s", target: 0 }, // تهدئة تدريجية في الآخر
  ],
};

export default function () {
  const res = http.get("http://localhost:5000/api/courses/all");
  check(res, { "status is 200": (r) => r.status === 200 });
  sleep(0.1);
}
