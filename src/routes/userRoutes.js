import express from "express";
import { getAllUsers, updateUserRole } from "../controllers/userController.js";
// import { protect, adminOnly } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get("/users", getAllUsers);
router.patch("/users/:userId", updateUserRole);

export default router;
