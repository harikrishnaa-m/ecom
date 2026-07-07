const express = require("express");
const router = express.Router();
const {
  createContactUs,
  getContactRequests,
  getContactRequestById,
} = require("../controllers/contactUsController");
const { protect, admin } = require("../middleware/authMiddleware");

router.post("/", createContactUs);
router.get("/", protect, admin, getContactRequests);
router.get("/:id", protect, admin, getContactRequestById);

module.exports = router;
