const CustomOrder = require("../models/CustomOrder");
const Product = require("../models/Product");
const Category = require("../models/Category");
const {
  createOrder: createRazorpayOrder,
  verifyPayment,
  verifyWebhookSignature,
} = require("../services/razorpayService");
const { uploadCategoryImage } = require("../services/digitalOceanSpaces");

const parseCustomerAddress = (body) => {
  if (body.customerAddress) {
    if (typeof body.customerAddress === "string") {
      try {
        return JSON.parse(body.customerAddress);
      } catch (_) {
        // continue to parse individual fields if JSON parsing fails
      }
    } else if (typeof body.customerAddress === "object") {
      return body.customerAddress;
    }
  }

  return {
    label:
      body["customerAddress[label]"] ||
      body["customerAddress.label"] ||
      body.label ||
      "Home",
    fullName:
      body["customerAddress[fullName]"] ||
      body["customerAddress.fullName"] ||
      body.fullName,
    phone:
      body["customerAddress[phone]"] ||
      body["customerAddress.phone"] ||
      body.phone,
    line1:
      body["customerAddress[line1]"] ||
      body["customerAddress.line1"] ||
      body.line1,
    line2:
      body["customerAddress[line2]"] ||
      body["customerAddress.line2"] ||
      body.line2,
    city:
      body["customerAddress[city]"] ||
      body["customerAddress.city"] ||
      body.city,
    state:
      body["customerAddress[state]"] ||
      body["customerAddress.state"] ||
      body.state,
    postalCode:
      body["customerAddress[postalCode]"] ||
      body["customerAddress.postalCode"] ||
      body.postalCode,
    country:
      body["customerAddress[country]"] ||
      body["customerAddress.country"] ||
      body.country ||
      "India",
  };
};

const buildCustomOrderPayload = async (req) => {
  const {
    productId,
    categoryId,
    requirement,
    budget,
    timeline,
    customerName,
    customerEmail,
    customerPhone,
  } = req.body;

  const payload = {
    user: req.user._id,
    customerName,
    customerEmail,
    customerPhone,
    customerAddress: parseCustomerAddress(req.body),
    product: productId,
    category: categoryId,
    requirement,
    budget: budget ? Number(budget) : undefined,
    timeline: timeline ? new Date(timeline) : undefined,
  };

  if (req.file) {
    payload.referenceImage = await uploadCategoryImage(req.file);
  }

  Object.keys(payload).forEach((key) => {
    if (payload[key] === undefined) delete payload[key];
  });

  return payload;
};

exports.createCustomOrder = async (req, res) => {
  try {
    const { productId, categoryId, requirement } = req.body;

    if (!productId || !categoryId || !requirement) {
      return res.status(400).json({
        message: "productId, categoryId, and requirement are required.",
      });
    }

    const product = await Product.findById(productId);
    const category = await Category.findById(categoryId);

    if (!product || !category) {
      return res.status(400).json({ message: "Invalid product or category." });
    }

    const payload = await buildCustomOrderPayload(req);

    if (
      !payload.customerAddress.fullName ||
      !payload.customerAddress.phone ||
      !payload.customerAddress.line1 ||
      !payload.customerAddress.city ||
      !payload.customerAddress.state ||
      !payload.customerAddress.postalCode ||
      !payload.customerAddress.country
    ) {
      return res.status(400).json({
        message:
          "Please provide a structured customerAddress with fullName, phone, line1, city, state, postalCode, and country.",
      });
    }

    const customOrder = await CustomOrder.create(payload);

    res.status(201).json({ customOrder });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to create custom order." });
  }
};

exports.getCustomOrders = async (req, res) => {
  try {
    const filter = {};
    if (req.user.role !== "admin") {
      filter.user = req.user._id;
    }

    const customOrders = await CustomOrder.find(filter)
      .populate("user", "name email phone")
      .populate("product", "name slug price")
      .populate("category", "name slug")
      .sort({ createdAt: -1 });

    res.json({ customOrders });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to fetch custom orders." });
  }
};

exports.getCustomOrderById = async (req, res) => {
  try {
    const filter = { _id: req.params.id };
    if (req.user.role !== "admin") {
      filter.user = req.user._id;
    }

    const customOrder = await CustomOrder.findOne(filter)
      .populate("user", "name email phone")
      .populate("product", "name slug price")
      .populate("category", "name slug");

    if (!customOrder) {
      return res.status(404).json({ message: "Custom order not found." });
    }

    res.json({ customOrder });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to fetch custom order." });
  }
};

exports.approveCustomOrder = async (req, res) => {
  try {
    const { approvedAmount } = req.body;
    const customOrder = await CustomOrder.findById(req.params.id);
    if (!customOrder) {
      return res.status(404).json({ message: "Custom order not found." });
    }

    if (customOrder.status !== "pending") {
      return res
        .status(400)
        .json({ message: "Only pending orders can be approved." });
    }

    if (approvedAmount == null || isNaN(Number(approvedAmount))) {
      return res
        .status(400)
        .json({ message: "approvedAmount is required and must be a number." });
    }

    customOrder.approvedAmount = Number(approvedAmount);
    customOrder.status = "approved";
    customOrder.approvedAt = new Date();
    await customOrder.save();

    res.json({ customOrder });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to approve custom order." });
  }
};

exports.rejectCustomOrder = async (req, res) => {
  try {
    const { rejectionReason } = req.body;
    const customOrder = await CustomOrder.findById(req.params.id);
    if (!customOrder) {
      return res.status(404).json({ message: "Custom order not found." });
    }

    if (customOrder.status !== "pending") {
      return res.status(400).json({
        message: "Only pending orders can be rejected.",
      });
    }

    customOrder.status = "rejected";
    customOrder.rejectedAt = new Date();
    customOrder.rejectionReason = rejectionReason;
    await customOrder.save();

    res.json({ customOrder });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to reject custom order." });
  }
};

const statusTransitions = {
  order_placed: ["processing"],
  processing: ["shipped"],
  shipped: ["complete"],
};

exports.updateCustomOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const allowedStatuses = ["processing", "shipped", "complete"];
    if (!status || !allowedStatuses.includes(status)) {
      return res.status(400).json({
        message: "Status must be one of: processing, shipped, complete.",
      });
    }

    const customOrder = await CustomOrder.findById(req.params.id);
    if (!customOrder) {
      return res.status(404).json({ message: "Custom order not found." });
    }

    const allowedNext = statusTransitions[customOrder.status] || [];
    if (!allowedNext.includes(status)) {
      return res.status(400).json({
        message: `Cannot change status from ${customOrder.status} to ${status}.`,
      });
    }

    customOrder.status = status;
    if (status === "processing") {
      customOrder.processingAt = new Date();
    } else if (status === "shipped") {
      customOrder.shippedAt = new Date();
    } else if (status === "complete") {
      customOrder.completedAt = new Date();
    }

    await customOrder.save();
    res.json({ customOrder });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to update custom order status." });
  }
};

exports.createCustomOrderPayment = async (req, res) => {
  try {
    const customOrder = await CustomOrder.findById(req.params.id);
    if (!customOrder) {
      return res.status(404).json({ message: "Custom order not found." });
    }

    if (!["approved", "payment_pending"].includes(customOrder.status)) {
      return res
        .status(400)
        .json({ message: "Custom order is not ready for payment." });
    }

    if (!customOrder.approvedAmount) {
      return res.status(400).json({ message: "Approved amount is not set." });
    }

    const razorpayOrder = await createRazorpayOrder({
      amount: customOrder.approvedAmount,
      currency: "INR",
      receipt: `custom_order_${customOrder._id}`,
    });

    customOrder.payment = {
      method: "razorpay",
      status: "created",
      providerOrderId: razorpayOrder.id,
      currency: "INR",
      amount: customOrder.approvedAmount,
    };
    await customOrder.save();

    res.json({ customOrder, razorpayOrder });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to create payment order." });
  }
};

exports.verifyCustomOrderPayment = async (req, res) => {
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

    const customOrder = await CustomOrder.findOne({
      "payment.providerOrderId": order_id,
    });
    if (!customOrder) {
      return res.status(404).json({ message: "Custom order not found." });
    }

    customOrder.payment.transactionId = payment_id;
    customOrder.payment.status = "paid";
    customOrder.status = "order_placed";
    customOrder.paidAt = new Date();
    await customOrder.save();

    res.json({ customOrder });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to verify custom order payment." });
  }
};

exports.customOrderWebhook = async (req, res) => {
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
    console.log(`[CustomOrder Webhook] Event received: ${event}`);
    const paymentEntity = payload.payload?.payment?.entity;

    if (event === "payment.captured" && paymentEntity) {
      const customOrder = await CustomOrder.findOne({
        "payment.providerOrderId": paymentEntity.order_id,
      });

      if (customOrder) {
        customOrder.payment.transactionId = paymentEntity.id;
        customOrder.payment.status = "paid";
        customOrder.status = "order_placed";
        customOrder.paidAt = new Date();
        await customOrder.save();
      }
    }

    res.status(200).json({ ok: true, event });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to handle webhook." });
  }
};
