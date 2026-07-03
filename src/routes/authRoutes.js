const express = require("express");
const router = express.Router();
const {
  registerUser,
  registerAdmin,
  loginUser,
  getProfile,
  googleSignIn,
  forgotPassword,
  resetPassword,
} = require("../controllers/authController");
const { protect, admin } = require("../middleware/authMiddleware");

router.post("/register", registerUser);
router.post("/register-admin", protect, admin, registerAdmin);
router.post("/login", loginUser);
router.post("/google", googleSignIn);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.get("/profile", protect, getProfile);

module.exports = router;
