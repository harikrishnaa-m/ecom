const Order = require("../models/Order");
const Product = require("../models/Product");
const {
  createOrder: createRazorpayOrder,
  verifyPayment,
  verifyWebhookSignature,
} = require("../services/razorpayService");

const calculateOrderTotals = (items, tax = 0, shipping = 0) => {
  const subtotal = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );
  const total = subtotal + tax + shipping;
  return { subtotal, total };
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

exports.createOrder = async (req, res) => {
  try {
    const { items, address, tax = 0, shipping = 0, notes } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Order items are required." });
    }
    if (!address) {
      return res.status(400).json({ message: "Address is required." });
    }

    const orderItems = await buildOrderItems(items);
    const totals = calculateOrderTotals(
      orderItems,
      Number(tax),
      Number(shipping),
    );

    const paymentOrder = await createRazorpayOrder({
      amount: totals.total,
      currency: "INR",
      receipt: `order_rcpt_${Date.now()}`,
    });

    const order = await Order.create({
      user: req.user._id,
      items: orderItems,
      address,
      payment: {
        method: "razorpay",
        status: "pending",
        providerOrderId: paymentOrder.id,
        currency: "INR",
        amount: totals.total,
      },
      subtotal: totals.subtotal,
      tax: Number(tax),
      shipping: Number(shipping),
      total: totals.total,
      status: "pending",
      notes,
    });

    res.status(201).json({
      order,
      razorpayOrder: paymentOrder,
    });
  } catch (error) {
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
    await order.save();

    res.json({ order });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to update order status." });
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

    const order = await Order.findOne({ "payment.providerOrderId": order_id });
    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    order.status = "paid";
    order.payment.status = "paid";
    order.payment.transactionId = payment_id;
    await order.save();

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
    const paymentEntity = payload.payload?.payment?.entity;
    const orderEntity = payload.payload?.order?.entity;
    const providerOrderId = paymentEntity?.order_id || orderEntity?.id;

    if (providerOrderId) {
      const order = await Order.findOne({
        "payment.providerOrderId": providerOrderId,
      });
      if (order) {
        if (event === "payment.failed") {
          order.status = "cancelled";
          order.payment.status = "failed";
        } else {
          order.status = "paid";
          order.payment.status = "paid";
          order.payment.transactionId =
            paymentEntity?.id || order.payment.transactionId;
        }
        await order.save();
      }
    }

    res.status(200).json({ ok: true, event });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to handle webhook." });
  }
};
