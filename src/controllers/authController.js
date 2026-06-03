// controllers/authController.js
import bcrypt from "bcryptjs";
import { User } from "../models/models.js";
// ==========================================
// REGISTER LOGIC
// ==========================================
export const registerUser = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // 1. Validation: Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res
        .status(400)
        .json({ message: "This email is already registered!" });
    }

    // 2. Security: Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 3. Creation: Create new user document
    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      role: role || "student",
    });

    // 4. Persistence: Save to MongoDB
    await newUser.save();

    res.status(201).json({ message: "User registered successfully!" });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ==========================================
// LOGIN LOGIC
// ==========================================
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Check if the user exists in the database
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid Email or Password!" });
    }

    // 2. Compare incoming plain text password with the stored hashed password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid Email or Password!" });
    }

    // 3. Generate a secure JWT Token containing user payload (ID and Role)
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }, // Token expires in 7 days for security reasons
    );

    // 4. Send back the token and public user profile details
    res.status(200).json({
      message: "Logged in successfully!",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};
