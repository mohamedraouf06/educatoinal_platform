import express from "express";
import {
  deleteUser,
  getAllUsers,
  updateUserRole,
} from "../controllers/userController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import adminMiddleware from "../middleware/adminMiddleware.js";

const router = express.Router();

router.get("/users", authMiddleware, adminMiddleware, getAllUsers);
router.patch("/users/:userId", authMiddleware, adminMiddleware, updateUserRole);
router.delete("/users/:userId", authMiddleware, adminMiddleware, deleteUser);

export default router;
