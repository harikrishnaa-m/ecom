const express = require("express");
const router = express.Router();
const {
  createOrder,
  getOrders,
  getOrderById,
  updateOrderStatus,
  verifyPayment,
  razorpayWebhook,
  cancelOrder,
} = require("../controllers/orderController");
const { protect, admin } = require("../middleware/authMiddleware");

router.post("/webhook", razorpayWebhook);
router.get("/", protect, getOrders);
router.get("/:id", protect, getOrderById);
router.post("/", protect, createOrder);
router.post("/verify-payment", protect, verifyPayment);
router.post("/:id/cancel", protect, cancelOrder);
router.patch("/:id/status", protect, admin, updateOrderStatus);

module.exports = router;
