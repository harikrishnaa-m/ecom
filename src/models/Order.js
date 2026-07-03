const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    slug: {
      type: String,
      required: true,
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

const addressSchema = new mongoose.Schema(
  {
    label: { type: String, trim: true },
    fullName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    line1: { type: String, required: true, trim: true },
    line2: { type: String, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    postalCode: { type: String, required: true, trim: true },
    country: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const refundSchema = new mongoose.Schema(
  {
    refundId: { type: String, trim: true },
    amount: { type: Number, min: 0, required: true },
    currency: { type: String, trim: true, default: "INR" },
    status: {
      type: String,
      enum: ["pending", "processed", "failed"],
      default: "pending",
    },
    reason: { type: String, trim: true },
    notes: { type: String, trim: true },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false },
);

const cancellationSchema = new mongoose.Schema(
  {
    reason: { type: String, trim: true },
    by: { type: String, enum: ["user", "admin"], default: "user" },
    note: { type: String, trim: true },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false },
);

const paymentSchema = new mongoose.Schema(
  {
    method: { type: String, trim: true, required: true },
    status: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded", "cancelled"],
      default: "pending",
    },
    transactionId: { type: String, trim: true },
    providerOrderId: { type: String, trim: true },
    currency: { type: String, trim: true, default: "INR" },
    amount: { type: Number, min: 0 },
  },
  { _id: false },
);

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    items: {
      type: [orderItemSchema],
      required: true,
      validate: [
        (items) => items.length > 0,
        "Order must contain at least one item.",
      ],
    },
    address: {
      type: addressSchema,
      required: true,
    },
    payment: {
      type: paymentSchema,
      required: true,
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    tax: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    shipping: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    total: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ["pending", "paid", "shipped", "delivered", "cancelled"],
      default: "pending",
    },
    deliveredAt: {
      type: Date,
    },
    notes: {
      type: String,
      trim: true,
    },
    refunds: {
      type: [refundSchema],
      default: [],
    },
    cancellations: {
      type: [cancellationSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Order", orderSchema);
