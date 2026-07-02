const Razorpay = require("razorpay");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
  throw new Error(
    "Razorpay environment variables are required: RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET",
  );
}

exports.createOrder = async ({ amount, currency, receipt }) => {
  const options = {
    amount: Math.round(amount * 100),
    currency,
    receipt,
    payment_capture: 1,
  };
  return razorpay.orders.create(options);
};

exports.verifyPayment = ({ orderId, paymentId, signature }) => {
  const crypto = require("crypto");
  const body = `${orderId}|${paymentId}`;
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(body.toString())
    .digest("hex");

  return expectedSignature === signature;
};

exports.createRefund = async ({ paymentId, amount, notes }) => {
  let payment;
  try {
    payment = await razorpay.payments.fetch(paymentId);
  } catch (error) {
    console.error("Razorpay payment fetch error:", {
      paymentId,
      error: {
        message: error?.message,
        name: error?.name,
        code: error?.code,
        statusCode: error?.statusCode,
        razorpayError: error?.error,
      },
    });
    throw new Error(
      error?.error?.description ||
        error?.message ||
        "Invalid payment fetch request.",
    );
  }

  console.log("Razorpay refund payment fetch:", {
    paymentId,
    paymentStatus: payment?.status,
    paymentAmount: payment?.amount,
    paymentCaptured: payment?.captured,
    paymentAmountRefunded: payment?.amount_refunded,
    paymentRefundStatus: payment?.refund_status,
    fullPayment: payment,
  });

  if (!payment) {
    throw new Error(`Payment ${paymentId} not found.`);
  }

  if (payment.status !== "captured") {
    throw new Error(
      `Payment ${paymentId} is not captured and cannot be refunded (status=${payment.status}).`,
    );
  }

  const refundAmount = Math.round(amount * 100);
  if (refundAmount > payment.amount) {
    throw new Error(
      `Refund amount ${refundAmount} exceeds payment amount ${payment.amount}.`,
    );
  }

  const options = {};
  if (refundAmount !== payment.amount) {
    options.amount = refundAmount;
  }

  console.log("Razorpay refund request options:", { paymentId, options });

  try {
    const refund =
      Object.keys(options).length > 0
        ? await razorpay.payments.refund(paymentId, options)
        : await razorpay.payments.refund(paymentId);
    console.log("Razorpay refund response:", refund);
    return refund;
  } catch (error) {
    console.error("Razorpay refund error details:", {
      paymentId,
      options,
      message: error?.message,
      name: error?.name,
      code: error?.code,
      statusCode: error?.statusCode,
      razorpayError: error?.error,
    });
    throw new Error(
      error?.error?.description || error?.message || "Invalid refund request.",
    );
  }
};

exports.verifyWebhookSignature = ({ payload, signature }) => {
  const crypto = require("crypto");
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (!webhookSecret) {
    throw new Error(
      "RAZORPAY_WEBHOOK_SECRET is required for webhook verification.",
    );
  }

  const expectedSignature = crypto
    .createHmac("sha256", webhookSecret)
    .update(payload)
    .digest("hex");

  return expectedSignature === signature;
};
