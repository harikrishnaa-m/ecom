const express = require("express");
const router = express.Router();
const {
  createReturnRequest,
  getReturnRequests,
  getReturnRequestById,
  updateReturnStatus,
  processReturnRefund,
} = require("../controllers/returnController");
const { protect, admin } = require("../middleware/authMiddleware");

router.post("/", protect, createReturnRequest);
router.get("/", protect, getReturnRequests);
router.get("/:id", protect, getReturnRequestById);
router.post("/:id/process-refund", protect, admin, processReturnRefund);
router.patch("/:id/status", protect, admin, updateReturnStatus);

module.exports = router;
