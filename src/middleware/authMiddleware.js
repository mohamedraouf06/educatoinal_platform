// ⚠️ لازم يتحمّل هنا بالذات (أول سطر) عشان ترتيب تحميل الـ ES Modules:
// كل الـ imports في المشروع بتتقيّم قبل ما جسم server.js (ومنه dotenv.config()) يشتغل،
// فمينفعش نعتمد إن server.js هو اللي هيحمّل الـ env قبل ما الملف ده يتقرأ
import "dotenv/config";
import jwt from "jsonwebtoken";

// ❗️ لازم الـ JWT_SECRET يكون متعرف في الـ .env، وإلا السيرفر مش هيقدر يتحقق من التوكنات بأمان
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error(
    "❌ JWT_SECRET is not defined in the environment variables (.env). Server cannot start without it.",
  );
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ message: "Unauthorized: No token provided!" });
  }
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // Attach user info (ID and Role) to the request object for later use

    next(); // Proceed to the next middleware or route handler
  } catch (error) {
    return res.status(401).json({ message: "Unauthorized: Invalid token!" });
  }
}
export default authMiddleware;
