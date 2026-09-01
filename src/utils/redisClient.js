// ⚠️ لازم يتحمّل هنا بالذات (أول سطر): courseController.js بيعمل import للملف ده،
// وكل الـ imports بتتقيّم قبل ما جسم الملف المستورِد (ومنه dotenv.config() بتاعه)
// يشتغل — فمن غير السطر ده، UPSTASH_REDIS_REST_URL/TOKEN تحت هيبقوا undefined
// دايمًا وقت التشغيل الحقيقي، والكاش هيفضل معطّل بصمت من غير أي error يوضح السبب.
import "dotenv/config";
import { Redis } from "@upstash/redis";

// لو UPSTASH_REDIS_REST_URL/TOKEN مش موجودين في .env، الكاش بيتعطل تلقائيًا
// والتطبيق بيشتغل عادي (بيقرا من المونجو مباشرة في كل مرة) — الكاش هنا تحسين
// اختياري مش ميزة أساسية زي الدفع أو الفيديو، فمينفعش نرمي error ونكسر السيرفر.
//
// ⚠️ Upstash REST API بيتوصل بيه عن طريق HTTP عادي (مش اتصال TCP دائم زي ioredis)،
// ده بالظبط اللي بيخليه مناسب لسيرفر عادي زي بتاعنا من غير أي إعداد إضافي.
const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

const redis =
  UPSTASH_REDIS_REST_URL && UPSTASH_REDIS_REST_TOKEN
    ? new Redis({ url: UPSTASH_REDIS_REST_URL, token: UPSTASH_REDIS_REST_TOKEN })
    : null;

export async function cacheGet(key) {
  if (!redis) return null;
  try {
    // @upstash/redis بيرجّع القيمة متفكوكة (parsed) تلقائيًا لو كانت JSON صالح
    const value = await redis.get(key);
    return value ?? null;
  } catch (err) {
    console.warn("⚠️ Redis get failed, falling back to DB:", err.message);
    return null;
  }
}

export async function cacheSet(key, value, ttlSeconds = 60) {
  if (!redis) return;
  try {
    await redis.set(key, value, { ex: ttlSeconds });
  } catch (err) {
    console.warn("⚠️ Redis set failed (non-fatal):", err.message);
  }
}

// بيمسح كل الـ keys اللي بتطابق pattern معيّن — مستخدمة وقت أي تعديل/حذف
// عشان الكاش القديم ميفضلش يرجّع بيانات قديمة بعد التحديث
export async function cacheDelPattern(pattern) {
  if (!redis) return;
  try {
    let cursor = "0";
    const allKeys = [];
    do {
      const [nextCursor, keys] = await redis.scan(cursor, { match: pattern, count: 100 });
      cursor = nextCursor;
      allKeys.push(...keys);
    } while (cursor !== "0");

    if (allKeys.length) await redis.del(...allKeys);
  } catch (err) {
    console.warn("⚠️ Redis invalidation failed (non-fatal):", err.message);
  }
}

export default redis;
