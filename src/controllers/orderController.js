const mongoose = require("mongoose");
const Order = require("../models/Order");
const ReturnRequest = require("../models/ReturnRequest");
const Product = require("../models/Product");
const Cart = require("../models/Cart");
const {
  createOrder: createRazorpayOrder,
  verifyPayment,
  verifyWebhookSignature,
  createRefund,
} = require("../services/razorpayService");

const calculateOrderTotals = (items, tax = 0, shipping = 0) => {
  const subtotal = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );
  const total = subtotal + tax + shipping;
  return { subtotal, total };
};

const getCartItems = async (userId) => {
  const cart = await Cart.findOne({ user: userId });
  if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
    return null;
  }
  return cart.items.map((item) => ({
    product: item.product,
    quantity: Number(item.quantity),
  }));
};

const reserveStock = async (items, session) => {
  const reserved = [];

  for (const item of items) {
    const product = await Product.findOneAndUpdate(
      {
        _id: item.product,
        stock: { $gte: item.quantity },
      },
      {
        $inc: { stock: -item.quantity },
      },
      {
        new: true,
        session,
      },
    );

    if (!product) {
      throw new Error(`Insufficient stock for product ${item.product}`);
    }

    reserved.push({ product: product._id, quantity: item.quantity });
  }

  return reserved;
};

const restoreReservedStock = async (reservedItems, session) => {
  for (const item of reservedItems) {
    await Product.findByIdAndUpdate(
      item.product,
      { $inc: { stock: item.quantity } },
      { session },
    );
  }
};

const buildOrderItems = async (cartItems) => {
  const items = [];
  for (const item of cartItems) {
    const product = await Product.findById(item.product);
    if (!product) {
      throw new Error(`Product not found: ${item.product}`);
    }
    items.push({
      product: product._id,
      name: product.name,
      slug: product.slug,
      price: product.price,
      quantity: item.quantity,
      subtotal: product.price * item.quantity,
    });
  }
  return items;
};

const restoreStockForOrder = async (items, session) => {
  for (const item of items) {
    await Product.findByIdAndUpdate(
      item.product,
      { $inc: { stock: item.quantity } },
      { session },
    );
  }
};

exports.createOrder = async (req, res) => {
  let reservedItems = [];

  try {
    const {
      paymentMethod = "online",
      items,
      address,
      tax = 0,
      shipping = 0,
      notes,
    } = req.body;

    if (!address) {
      return res.status(400).json({ message: "Address is required." });
    }

    if (!["online", "cod"].includes(paymentMethod)) {
      return res.status(400).json({ message: "Invalid payment method." });
    }

    let orderItemsPayload = items;
    if (!Array.isArray(orderItemsPayload) || orderItemsPayload.length === 0) {
      orderItemsPayload = await getCartItems(req.user._id);
      if (!orderItemsPayload) {
        return res.status(400).json({
          message: "Order items are required or cart must contain items.",
        });
      }
    }

    const orderItems = await buildOrderItems(orderItemsPayload);
    const totals = calculateOrderTotals(
      orderItems,
      Number(tax),
      Number(shipping),
    );

    reservedItems = await reserveStock(orderItemsPayload);

    const payment = {
      method: paymentMethod === "online" ? "razorpay" : "cod",
      status: "pending",
      currency: "INR",
      amount: totals.total,
    };

    let razorpayOrder = null;
    if (paymentMethod === "online") {
      razorpayOrder = await createRazorpayOrder({
        amount: totals.total,
        currency: "INR",
        receipt: `order_rcpt_${Date.now()}`,
      });
      payment.providerOrderId = razorpayOrder.id;
    }

    const order = await Order.create({
      user: req.user._id,
      items: orderItems,
      address,
      payment,
      subtotal: totals.subtotal,
      tax: Number(tax),
      shipping: Number(shipping),
      total: totals.total,
      status: "pending",
      notes,
    });

    if (paymentMethod === "cod") {
      await Cart.findOneAndDelete({ user: req.user._id });
    }

    const responsePayload = { order };
    if (razorpayOrder) {
      responsePayload.razorpayOrder = razorpayOrder;
    }

    res.status(201).json(responsePayload);
  } catch (error) {
    if (reservedItems.length > 0) {
      try {
        await restoreReservedStock(reservedItems);
      } catch (restoreError) {
        console.error("Failed to restore reserved stock:", restoreError);
      }
    }

    console.error(error);
    res
      .status(500)
      .json({ message: error.message || "Unable to create order." });
  }
};

exports.getOrders = async (req, res) => {
  try {
    const filter = {};
    if (req.user.role !== "admin") {
      filter.user = req.user._id;
    }
    const orders = await Order.find(filter).sort({ createdAt: -1 });
    res.json({ orders });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to fetch orders." });
  }
};

exports.getOrderById = async (req, res) => {
  try {
    const filter = { _id: req.params.id };
    if (req.user.role !== "admin") {
      filter.user = req.user._id;
    }

    const order = await Order.findOne(filter);
    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }
    res.json({ order });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to fetch order." });
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    if (
      !["pending", "paid", "shipped", "delivered", "cancelled"].includes(status)
    ) {
      return res.status(400).json({ message: "Invalid order status." });
    }

    order.status = status;
    if (status === "delivered") {
      order.deliveredAt = new Date();
    }
    await order.save();

    res.json({ order });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to update order status." });
  }
};

exports.cancelOrder = async (req, res) => {
  let session;

  try {
    const { reason } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    if (req.user.role !== "admin" && !order.user.equals(req.user._id)) {
      return res
        .status(403)
        .json({ message: "Not authorized to cancel this order." });
    }

    if (order.status === "cancelled") {
      return res.status(400).json({ message: "Order is already cancelled." });
    }

    session = await mongoose.startSession();
    session.startTransaction();

    const cancellationRecord = {
      reason: reason || "Order cancelled",
      by: req.user.role === "admin" ? "admin" : "user",
      note: reason || "",
    };

    if (
      order.payment.method === "razorpay" &&
      order.payment.status === "paid"
    ) {
      if (!order.payment.transactionId) {
        throw new Error("Paid order has no payment transaction ID.");
      }

      let refund;
      try {
        refund = await createRefund({
          paymentId: order.payment.transactionId,
          amount: order.payment.amount,
          notes: { reason: cancellationRecord.reason },
        });
      } catch (refundError) {
        console.error("Refund request failed:", {
          paymentId: order.payment.transactionId,
          amount: order.payment.amount,
          error: refundError,
        });

        const razorpayMessage =
          refundError?.error?.description ||
          refundError?.error?.reason ||
          refundError?.message ||
          "invalid request sent";

        throw new Error(`Refund failed: ${razorpayMessage}`);
      }

      order.refunds.push({
        refundId: refund.id,
        amount: order.payment.amount,
        currency: refund.currency || order.payment.currency,
        status: refund.status || "processed",
        reason: cancellationRecord.reason,
        notes: refund.notes ? JSON.stringify(refund.notes) : "",
      });
      order.payment.status = "refunded";
    } else if (
      order.payment.method === "razorpay" &&
      order.payment.status === "pending"
    ) {
      order.payment.status = "cancelled";
    }

    order.status = "cancelled";
    order.cancellations.push(cancellationRecord);

    await restoreStockForOrder(order.items, session);
    await order.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.json({ order });
  } catch (error) {
    if (session) {
      await session.abortTransaction();
      session.endSession();
    }
    console.error(error);
    res
      .status(500)
      .json({ message: error.message || "Unable to cancel order." });
  }
};

exports.verifyPayment = async (req, res) => {
  try {
    const { order_id, payment_id, signature } = req.body;
    if (!order_id || !payment_id || !signature) {
      return res.status(400).json({ message: "Payment details are required." });
    }

    const isValid = verifyPayment({
      orderId: order_id,
      paymentId: payment_id,
      signature,
    });

    if (!isValid) {
      return res.status(400).json({ message: "Payment verification failed." });
    }

    const filter = { "payment.providerOrderId": order_id };
    if (req.user.role !== "admin") {
      filter.user = req.user._id;
    }

    const order = await Order.findOne(filter);
    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    order.status = "paid";
    order.payment.status = "paid";
    order.payment.transactionId = payment_id;
    await order.save();

    await Cart.findOneAndDelete({ user: order.user });

    res.json({ order });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to verify payment." });
  }
};

exports.razorpayWebhook = async (req, res) => {
  try {
    const signature = req.headers["x-razorpay-signature"];

    if (!signature) {
      return res.status(400).send("Missing Razorpay signature.");
    }

    if (!req.rawBody) {
      return res
        .status(400)
        .send("Raw body is required for webhook verification.");
    }

    const isValid = verifyWebhookSignature({
      payload: req.rawBody,
      signature,
    });

    if (!isValid) {
      return res.status(400).send("Invalid webhook signature.");
    }

    const payload = JSON.parse(req.rawBody.toString());
    const event = payload.event;
    console.log(`[Webhook] Event received: ${event}`);
    const paymentEntity = payload.payload?.payment?.entity;
    const orderEntity = payload.payload?.order?.entity;
    const refundEntity = payload.payload?.refund?.entity;
    const providerOrderId = paymentEntity?.order_id || orderEntity?.id;

    let order = null;
    if (providerOrderId) {
      order = await Order.findOne({
        "payment.providerOrderId": providerOrderId,
      });
    }

    if (!order && refundEntity) {
      order = await Order.findOne({
        "payment.transactionId": refundEntity.payment_id,
      });
    }

    if (order) {
      if (refundEntity && event && event.startsWith("refund.")) {
        const refundId = refundEntity.id;
        let refundRecord = order.refunds.find((r) => r.refundId === refundId);

        if (!refundRecord) {
          refundRecord = {
            refundId,
            amount: refundEntity.amount
              ? refundEntity.amount / 100
              : order.payment.amount,
            currency: refundEntity.currency || order.payment.currency,
            status: refundEntity.status || "pending",
            reason: refundEntity.notes
              ? JSON.stringify(refundEntity.notes)
              : "refund event",
            notes: refundEntity.notes ? JSON.stringify(refundEntity.notes) : "",
            createdAt: new Date(),
          };
          order.refunds.push(refundRecord);
        } else {
          refundRecord.status = refundEntity.status || refundRecord.status;
          refundRecord.amount = refundEntity.amount
            ? refundEntity.amount / 100
            : refundRecord.amount;
          refundRecord.currency =
            refundEntity.currency || refundRecord.currency;
          refundRecord.notes = refundEntity.notes
            ? JSON.stringify(refundEntity.notes)
            : refundRecord.notes;
        }

        if (refundEntity.status === "processed") {
          const refundAmount = refundEntity.amount
            ? refundEntity.amount / 100
            : null;

          const isFullRefund =
            refundAmount && refundAmount === order.payment.amount;

          if (order.status === "cancelled" || isFullRefund) {
            order.payment.status = "refunded";
            order.status = "cancelled";
          }

          const returnRequest = await ReturnRequest.findOne({
            refundId,
          });
          if (returnRequest) {
            returnRequest.refundStatus = "processed";
            returnRequest.status = "refund_processed";
            returnRequest.refundedAt = new Date();
            await returnRequest.save();
          }
        }

        await order.save();
      } else if (
        event === "payment.failed" &&
        order.payment.status === "pending"
      ) {
        await restoreReservedStock(
          order.items.map((item) => ({
            product: item.product,
            quantity: item.quantity,
          })),
        );
        order.status = "cancelled";
        order.payment.status = "failed";
        await order.save();
      } else if (event !== "payment.failed" && !event.startsWith("refund.")) {
        order.status = "paid";
        order.payment.status = "paid";
        order.payment.transactionId =
          paymentEntity?.id || order.payment.transactionId;
        await order.save();
        await Cart.findOneAndDelete({ user: order.user });
      }
    }

    res.status(200).json({ ok: true, event });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to handle webhook." });
  }
};
