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
