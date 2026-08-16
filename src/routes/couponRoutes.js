import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import adminMiddleware from "../middleware/adminMiddleware.js";
import {
  createCoupon,
  getAllCoupons,
  deleteCoupon,
} from "../controllers/couponController.js";

const router = express.Router();

router.post("/", authMiddleware, adminMiddleware, createCoupon);
router.get("/", authMiddleware, adminMiddleware, getAllCoupons);
router.delete("/:id", authMiddleware, adminMiddleware, deleteCoupon);

export default router;
