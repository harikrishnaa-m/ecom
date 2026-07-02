const mongoose = require("mongoose");
const ReturnRequest = require("../models/ReturnRequest");
const Order = require("../models/Order");
const { createRefund } = require("../services/razorpayService");
const { protect, admin } = require("../middleware/authMiddleware");

const isWithinReturnWindow = (deliveredAt) => {
  if (!deliveredAt) return false;
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  return Date.now() - new Date(deliveredAt).getTime() <= sevenDays;
};

exports.createReturnRequest = async (req, res) => {
  try {
    const { orderId, reason, items, notes } = req.body;
    if (!orderId || !reason || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        message:
          "orderId, reason, and items are required for a return request.",
      });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    if (!order.user.equals(req.user._id)) {
      return res
        .status(403)
        .json({ message: "Not authorized to return this order." });
    }

    if (order.payment.method !== "razorpay") {
      return res
        .status(400)
        .json({ message: "Only online paid orders are returnable." });
    }

    if (order.status !== "delivered") {
      return res.status(400).json({
        message: "Order must be delivered before a return can be requested.",
      });
    }

    if (!isWithinReturnWindow(order.deliveredAt)) {
      return res.status(400).json({ message: "Return window has expired." });
    }

    const existing = await ReturnRequest.findOne({
      order: orderId,
      user: req.user._id,
      status: { $nin: ["refund_processed", "rejected"] },
    });
    if (existing) {
      return res.status(400).json({
        message: "A return request is already in progress for this order.",
      });
    }

    const seenProductIds = new Set();
    const returnItems = [];
    let refundAmount = 0;

    for (const item of items) {
      const { productId, quantity } = item;
      if (!productId || !quantity || quantity < 1) {
        return res.status(400).json({
          message:
            "Each return item must include a valid productId and quantity.",
        });
      }

      if (seenProductIds.has(productId.toString())) {
        return res
          .status(400)
          .json({ message: "Duplicate productId in return items." });
      }
      seenProductIds.add(productId.toString());

      const orderItem = order.items.find(
        (orderItem) => orderItem.product.toString() === productId.toString(),
      );
      if (!orderItem) {
        return res.status(400).json({
          message: `Product ${productId} is not part of the order.`,
        });
      }

      if (quantity > orderItem.quantity) {
        return res.status(400).json({
          message: `Return quantity for ${orderItem.name} cannot exceed ordered quantity (${orderItem.quantity}).`,
        });
      }

      const subtotal = orderItem.price * quantity;
      refundAmount += subtotal;

      returnItems.push({
        product: orderItem.product,
        name: orderItem.name,
        price: orderItem.price,
        quantity,
        subtotal,
      });
    }

    const returnRequest = await ReturnRequest.create({
      order: orderId,
      user: req.user._id,
      items: returnItems,
      reason,
      refundAmount,
      notes,
    });

    res.status(201).json({ returnRequest });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to create return request." });
  }
};

exports.getReturnRequests = async (req, res) => {
  try {
    const filter = {};
    if (req.user.role !== "admin") {
      filter.user = req.user._id;
    }

    const validStatuses = [
      "requested",
      "approved",
      "picked_up",
      "qc_passed",
      "refund_processed",
      "rejected",
    ];

    if (req.query.status) {
      const status = req.query.status.toLowerCase();
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: "Invalid status filter." });
      }
      filter.status = status;
    }

    const returns = await ReturnRequest.find(filter).sort({ createdAt: -1 });
    res.json({ returns });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to fetch return requests." });
  }
};

exports.getReturnRequestById = async (req, res) => {
  try {
    const returnRequest = await ReturnRequest.findById(req.params.id);
    if (!returnRequest) {
      return res.status(404).json({ message: "Return request not found." });
    }

    if (req.user.role !== "admin" && !returnRequest.user.equals(req.user._id)) {
      return res
        .status(403)
        .json({ message: "Not authorized to view this return request." });
    }

    res.json({ returnRequest });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to fetch return request." });
  }
};

exports.processReturnRefund = async (req, res) => {
  let session;

  try {
    const returnRequest = await ReturnRequest.findById(req.params.id);
    if (!returnRequest) {
      return res.status(404).json({ message: "Return request not found." });
    }

    if (returnRequest.status === "refund_processed") {
      return res
        .status(400)
        .json({ message: "Refund has already been processed." });
    }

    if (returnRequest.status === "rejected") {
      return res
        .status(400)
        .json({ message: "Cannot refund a rejected return." });
    }

    const order = await Order.findById(returnRequest.order);
    if (!order) {
      return res.status(404).json({ message: "Associated order not found." });
    }

    if (order.payment.method !== "razorpay" || !order.payment.transactionId) {
      return res.status(400).json({
        message: "Return refunds are only supported for Razorpay-paid orders.",
      });
    }

    session = await mongoose.startSession();
    session.startTransaction();

    const refund = await createRefund({
      paymentId: order.payment.transactionId,
      amount: returnRequest.refundAmount,
      notes: { reason: `Return refund for request ${returnRequest._id}` },
    });

    order.refunds.push({
      refundId: refund.id,
      amount: returnRequest.refundAmount,
      currency: refund.currency || order.payment.currency,
      status: refund.status || "processed",
      reason: `Return refund for request ${returnRequest._id}`,
      notes: refund.notes ? JSON.stringify(refund.notes) : "",
    });
    returnRequest.refundId = refund.id;
    returnRequest.refundStatus = refund.status || "pending";
    returnRequest.refundInitiatedAt = new Date();
    returnRequest.qcPassedAt = new Date();

    if (returnRequest.status !== "qc_passed") {
      returnRequest.status = "qc_passed";
    }

    await order.save({ session });
    await returnRequest.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.json({ returnRequest, refund });
  } catch (error) {
    if (session) {
      await session.abortTransaction();
      session.endSession();
    }
    console.error(error);
    res
      .status(500)
      .json({ message: error.message || "Unable to process return refund." });
  }
};

exports.updateReturnStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = [
      "requested",
      "approved",
      "picked_up",
      "qc_passed",
      "refund_processed",
      "rejected",
    ];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid return status." });
    }

    const returnRequest = await ReturnRequest.findById(req.params.id);
    if (!returnRequest) {
      return res.status(404).json({ message: "Return request not found." });
    }

    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Admin access required." });
    }

    returnRequest.status = status;
    if (status === "approved") {
      returnRequest.approvedAt = new Date();
    }
    if (status === "picked_up") {
      returnRequest.pickedUpAt = new Date();
    }
    if (status === "qc_passed") {
      returnRequest.qcPassedAt = new Date();
    }
    if (status === "refund_processed") {
      returnRequest.refundedAt = new Date();
    }
    if (status === "rejected") {
      returnRequest.rejectedAt = new Date();
    }

    await returnRequest.save();
    res.json({ returnRequest });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to update return request." });
  }
};
