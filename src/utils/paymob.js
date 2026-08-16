import { createHmac } from "node:crypto";

// المفاتيح دي بتتقرا من .env — لو لسه ما ضفتهاش، أي محاولة دفع هترجع خطأ واضح
// بدل ما تكسر السيرفر كله (نفس فلسفة bunnyStream.js)
const PAYMOB_API_KEY = process.env.PAYMOB_API_KEY;
const PAYMOB_INTEGRATION_ID = process.env.PAYMOB_INTEGRATION_ID;
const PAYMOB_IFRAME_ID = process.env.PAYMOB_IFRAME_ID;
const PAYMOB_HMAC_SECRET = process.env.PAYMOB_HMAC_SECRET;

const PAYMOB_BASE = "https://accept.paymob.com/api";

function assertPaymobConfigured() {
  if (!PAYMOB_API_KEY || !PAYMOB_INTEGRATION_ID || !PAYMOB_IFRAME_ID) {
    throw new Error(
      "Paymob is not configured. Please set PAYMOB_API_KEY, PAYMOB_INTEGRATION_ID and PAYMOB_IFRAME_ID in .env",
    );
  }
}

// 1) طلب Auth Token من Paymob (أول خطوة في أي عملية دفع)
export async function getPaymobAuthToken() {
  assertPaymobConfigured();

  const res = await fetch(`${PAYMOB_BASE}/auth/tokens`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: PAYMOB_API_KEY }),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Paymob auth failed (${res.status}): ${errorBody}`);
  }

  const data = await res.json();
  return data.token;
}

// 2) إنشاء Order عند Paymob وإرجاع الـ order id بتاعه
export async function createPaymobOrder(authToken, amountCents) {
  const res = await fetch(`${PAYMOB_BASE}/ecommerce/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      auth_token: authToken,
      delivery_needed: false,
      amount_cents: amountCents,
      currency: "EGP",
      items: [],
    }),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Paymob order creation failed (${res.status}): ${errorBody}`);
  }

  const data = await res.json();
  return data.id;
}

// 3) طلب Payment Key — التوكن اللي بنستخدمه نبني بيه رابط صفحة الدفع (iframe)
export async function getPaymobPaymentKey(authToken, amountCents, orderId, billing) {
  const res = await fetch(`${PAYMOB_BASE}/acceptance/payment_keys`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      auth_token: authToken,
      amount_cents: amountCents,
      expiration: 3600,
      order_id: orderId,
      billing_data: {
        apartment: "NA",
        email: billing.email,
        floor: "NA",
        first_name: billing.firstName,
        street: "NA",
        building: "NA",
        phone_number: billing.phone || "+201000000000",
        shipping_method: "NA",
        postal_code: "NA",
        city: "NA",
        country: "NA",
        last_name: billing.lastName,
        state: "NA",
      },
      currency: "EGP",
      integration_id: Number(PAYMOB_INTEGRATION_ID),
    }),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(
      `Paymob payment key request failed (${res.status}): ${errorBody}`,
    );
  }

  const data = await res.json();
  return data.token;
}

// 4) بناء رابط صفحة الدفع (iframe) اللي بنوجّه الطالب له
export function buildPaymobIframeUrl(paymentToken) {
  assertPaymobConfigured();
  return `https://accept.paymob.com/api/acceptance/iframes/${PAYMOB_IFRAME_ID}?payment_token=${paymentToken}`;
}

// ترتيب الحقول الرسمي من مستندات Paymob لحساب الـ HMAC بتاع الـ webhook
// https://docs.paymob.com/docs/transaction-callbacks
const HMAC_FIELDS_ORDER = [
  "amount_cents",
  "created_at",
  "currency",
  "error_occured",
  "has_parent_transaction",
  "id",
  "integration_id",
  "is_3d_secure",
  "is_auth",
  "is_capture",
  "is_refunded",
  "is_standalone_payment",
  "is_voided",
  "order.id",
  "owner",
  "pending",
  "source_data.pan",
  "source_data.sub_type",
  "source_data.type",
  "success",
];

function getNestedValue(obj, path) {
  return path
    .split(".")
    .reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
}

// 5) التحقق من إن الـ webhook جاي فعلاً من Paymob ومحدش زوّره
// بنجمع القيم بالترتيب الرسمي ده، ونعمل HMAC-SHA512 بمفتاح السر، ونقارنه بالـ hmac الجاي في الـ query
export function verifyPaymobHmac(transactionObj, receivedHmac) {
  if (!PAYMOB_HMAC_SECRET) {
    throw new Error("PAYMOB_HMAC_SECRET is not configured in .env");
  }

  if (!receivedHmac) return false;

  const concatenated = HMAC_FIELDS_ORDER.map((field) => {
    const value = getNestedValue(transactionObj, field);
    return value === undefined || value === null ? "" : String(value);
  }).join("");

  const computedHmac = createHmac("sha512", PAYMOB_HMAC_SECRET)
    .update(concatenated)
    .digest("hex");

  return computedHmac === receivedHmac;
}
