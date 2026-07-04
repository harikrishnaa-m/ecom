const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    method: {
      type: String,
      trim: true,
      default: "razorpay",
    },
    status: {
      type: String,
      enum: ["pending", "created", "paid", "failed"],
      default: "pending",
    },
    providerOrderId: {
      type: String,
      trim: true,
    },
    transactionId: {
      type: String,
      trim: true,
    },
    currency: {
      type: String,
      trim: true,
      default: "INR",
    },
    amount: {
      type: Number,
      min: 0,
    },
  },
  { _id: false },
);

const customOrderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    customerName: {
      type: String,
      trim: true,
    },
    customerEmail: {
      type: String,
      trim: true,
      lowercase: true,
    },
    customerPhone: {
      type: String,
      trim: true,
    },
    customerAddress: {
      label: {
        type: String,
        trim: true,
        default: "Home",
      },
      fullName: {
        type: String,
        required: true,
        trim: true,
      },
      phone: {
        type: String,
        required: true,
        trim: true,
      },
      line1: {
        type: String,
        required: true,
        trim: true,
      },
      line2: {
        type: String,
        trim: true,
      },
      city: {
        type: String,
        required: true,
        trim: true,
      },
      state: {
        type: String,
        required: true,
        trim: true,
      },
      postalCode: {
        type: String,
        required: true,
        trim: true,
      },
      country: {
        type: String,
        required: true,
        trim: true,
        default: "India",
      },
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    referenceImage: {
      type: String,
      trim: true,
    },
    requirement: {
      type: String,
      trim: true,
    },
    budget: {
      type: Number,
      min: 0,
    },
    timeline: {
      type: Date,
    },
    status: {
      type: String,
      enum: [
        "pending",
        "rejected",
        "approved",
        "payment_pending",
        "order_placed",
        "processing",
        "shipped",
        "complete",
      ],
      default: "pending",
    },
    approvedAmount: {
      type: Number,
      min: 0,
    },
    payment: {
      type: paymentSchema,
      default: () => ({}),
    },
    approvedAt: {
      type: Date,
    },
    paidAt: {
      type: Date,
    },
    processingAt: {
      type: Date,
    },
    shippedAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
    rejectedAt: {
      type: Date,
    },
    rejectionReason: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("CustomOrder", customOrderSchema);
