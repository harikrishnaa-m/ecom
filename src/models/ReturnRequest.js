const mongoose = require("mongoose");

const returnItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false },
);

const returnRequestSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    items: {
      type: [returnItemSchema],
      required: true,
      validate: [
        (items) => items.length > 0,
        "Return request must contain at least one item.",
      ],
    },
    status: {
      type: String,
      enum: [
        "requested",
        "approved",
        "picked_up",
        "qc_passed",
        "refund_processed",
        "rejected",
      ],
      default: "requested",
    },
    reason: {
      type: String,
      trim: true,
      required: true,
    },
    refundAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    refundId: {
      type: String,
      trim: true,
    },
    refundStatus: {
      type: String,
      enum: ["pending", "processed", "failed"],
      default: "pending",
    },
    refundInitiatedAt: {
      type: Date,
    },
    notes: {
      type: String,
      trim: true,
    },
    approvedAt: {
      type: Date,
    },
    pickedUpAt: {
      type: Date,
    },
    qcPassedAt: {
      type: Date,
    },
    refundedAt: {
      type: Date,
    },
    rejectedAt: {
      type: Date,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("ReturnRequest", returnRequestSchema);
