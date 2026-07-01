const express = require("express");
const router = express.Router();
const {
  registerUser,
  registerAdmin,
  loginUser,
  getProfile,
} = require("../controllers/authController");
const { protect, admin } = require("../middleware/authMiddleware");

router.post("/register", registerUser);
router.post("/register-admin", protect, admin, registerAdmin);
router.post("/login", loginUser);
router.get("/profile", protect, getProfile);

module.exports = router;
