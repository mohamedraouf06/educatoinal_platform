// ⚠️ لازم يتحمّل هنا بالذات (أول سطر): courseController.js بيعمل import للملف ده،
// وكل الـ imports بتتقيّم قبل ما جسم الملف المستورِد (ومنه dotenv.config() بتاعه)
// يشتغل — فمن غير السطر ده، UPSTASH_REDIS_REST_URL/TOKEN تحت هيبقوا undefined
// دايمًا وقت التشغيل الحقيقي، والكاش هيفضل معطّل بصمت من غير أي error يوضح السبب.
import "dotenv/config";
import { Redis } from "@upstash/redis";
import { LRUCache } from "lru-cache";

// ==========================================================
// L1 — كاش في ذاكرة نفس السيرفر (Node process). أسرع حاجة ممكنة (microseconds،
// من غير أي اتصال شبكة خالص)، لكن كل Instance له نسخته الخاصة منفصلة عن التانية.
//
// TTL قصير جدًا (5 ثواني) عمدًا: إحنا شغّالين Instance واحد بس دلوقتي فمفيش مشكلة،
// لكن لو حصل Scale لأكتر من Instance بعدين، كل Instance هيمسح L1 بتاعه بس وقت أي
// تعديل (مش هيعرف يبلّغ الباقي) — الـ TTL القصير ده بيحدد أقصى مدة ممكن أي Instance
// يفضل فيها شايل نسخة قديمة، بدل ما يفضل شايلها لحد ما الـ 60 ثانية بتاعة L2 تخلص.
// ==========================================================
const l1 = new LRUCache({ max: 500, ttl: 5 * 1000 });

// ==========================================================
// L2 — Upstash Redis (REST API). أبطأ من L1 (فيه رحلة شبكة فعلية)، لكن مشترك بين
// كل الـ Instances، فهو مصدر الحقيقة المشترك لما L1 يكون فاضي أو منتهي الصلاحية.
// لو UPSTASH_REDIS_REST_URL/TOKEN مش موجودين، L2 بيتعطل والكاش يفضل L1 بس.
// ==========================================================
const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

const redis =
  UPSTASH_REDIS_REST_URL && UPSTASH_REDIS_REST_TOKEN
    ? new Redis({ url: UPSTASH_REDIS_REST_URL, token: UPSTASH_REDIS_REST_TOKEN })
    : null;

export async function cacheGet(key) {
  // 1) L1 الأول — لو موجود، رجّعه فورًا من غير ما نلمس الشبكة خالص
  const l1Value = l1.get(key);
  if (l1Value !== undefined) return l1Value;

  // 2) L2 لو L1 فاضي أو منتهي — ولو لقينا حاجة، نرجّع نملى L1 بيها عشان الطلب الجاي يبقى L1 hit
  if (!redis) return null;
  try {
    const value = await redis.get(key);
    if (value !== null && value !== undefined) {
      l1.set(key, value);
      return value;
    }
    return null;
  } catch (err) {
    console.warn("⚠️ Redis get failed, falling back to DB:", err.message);
    return null;
  }
}

export async function cacheSet(key, value, ttlSeconds = 60) {
  // بنكتب في الاتنين مع بعض: L1 بسقفه القصير الثابت، وL2 بالمدة الحقيقية المطلوبة
  l1.set(key, value);

  if (!redis) return;
  try {
    await redis.set(key, value, { ex: ttlSeconds });
  } catch (err) {
    console.warn("⚠️ Redis set failed (non-fatal):", err.message);
  }
}

// بيمسح كل الـ keys اللي بتطابق pattern معيّن (من L1 وL2 مع بعض) — مستخدمة وقت
// أي تعديل/حذف عشان الكاش القديم ميفضلش يرجّع بيانات قديمة بعد التحديث
export async function cacheDelPattern(pattern) {
  // L1: pattern بسيط بـ "*" بس، بنحوّله لـ RegExp ونمسح أي مفتاح مطابق من ذاكرة السيرفر ده
  const regex = new RegExp("^" + pattern.split("*").map(escapeRegex).join(".*") + "$");
  for (const key of l1.keys()) {
    if (regex.test(key)) l1.delete(key);
  }

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

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export default redis;
