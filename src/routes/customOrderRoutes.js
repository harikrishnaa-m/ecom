const express = require("express");
const router = express.Router();
const multer = require("multer");
const { protect, admin } = require("../middleware/authMiddleware");
const {
  createCustomOrder,
  getCustomOrders,
  getCustomOrderById,
  approveCustomOrder,
  rejectCustomOrder,
  updateCustomOrderStatus,
  createCustomOrderPayment,
  verifyCustomOrderPayment,
  customOrderWebhook,
} = require("../controllers/customOrderController");

const upload = multer({ storage: multer.memoryStorage() });

router.post("/webhook", customOrderWebhook);
router.post("/", protect, upload.single("referenceImage"), createCustomOrder);
router.get("/", protect, getCustomOrders);
router.get("/:id", protect, getCustomOrderById);
router.patch("/:id/approve", protect, admin, approveCustomOrder);
router.patch("/:id/reject", protect, admin, rejectCustomOrder);
router.post("/:id/payment", protect, createCustomOrderPayment);
router.post("/:id/verify-payment", protect, verifyCustomOrderPayment);
router.patch("/:id/status", protect, admin, updateCustomOrderStatus);

module.exports = router;
