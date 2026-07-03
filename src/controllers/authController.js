const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const { OAuth2Client } = require("google-auth-library");
const User = require("../models/User");

const createToken = (user) => {
  return jwt.sign(
    {
      userId: user._id,
      role: user.role,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "30d",
    },
  );
};

const createTransporter = () => {
  const host = process.env.EMAIL_HOST;
  const port = Number(process.env.EMAIL_PORT || 587);
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;
  const secure = process.env.EMAIL_SECURE === "true";

  if (!host || !user || !pass) {
    throw new Error(
      "Email configuration is required: EMAIL_HOST, EMAIL_USER, EMAIL_PASS",
    );
  }

  const rejectUnauthorized =
    process.env.EMAIL_REJECT_UNAUTHORIZED === "false" ? false : undefined;

  const transportOptions = {
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  };

  if (rejectUnauthorized === false) {
    transportOptions.tls = { rejectUnauthorized: false };
  }

  return nodemailer.createTransport(transportOptions);
};

const generateOtp = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const sendResetOtpEmail = async (email, otp) => {
  const transporter = createTransporter();
  const mailOptions = {
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to: email,
    subject: "Password reset OTP",
    text: `Your password reset code is ${otp}. It is valid for 15 minutes.`,
    html: `<p>Your password reset code is <strong>${otp}</strong>.</p><p>It is valid for 15 minutes.</p>`,
  };
  await transporter.sendMail(mailOptions);
};

const register = async (req, res, role) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res
      .status(400)
      .json({ message: "Name, email, and password are required." });
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(400).json({ message: "Email is already registered." });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await User.create({
    name,
    email,
    password: hashedPassword,
    role,
  });

  const token = createToken(user);

  res.status(201).json({
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });
};

exports.registerUser = async (req, res) => {
  try {
    await register(req, res, "user");
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to register user." });
  }
};

exports.registerAdmin = async (req, res) => {
  try {
    await register(req, res, "admin");
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to register admin." });
  }
};

exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required." });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    const token = createToken(user);

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to login." });
  }
};

exports.googleSignIn = async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({ message: "idToken is required." });
    }

    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();

    if (!payload || !payload.email) {
      return res.status(400).json({ message: "Invalid Google token." });
    }

    const email = payload.email.toLowerCase();
    const name = payload.name || payload.email.split("@")[0];
    const emailVerified = payload.email_verified;

    if (!emailVerified) {
      return res
        .status(400)
        .json({ message: "Google email must be verified." });
    }

    let user = await User.findOne({
      $or: [{ email }, { googleId: payload.sub }],
    });

    if (!user) {
      const randomPassword = await bcrypt.hash(
        Math.random().toString(36).slice(-12),
        10,
      );
      user = await User.create({
        name,
        email,
        password: randomPassword,
        googleId: payload.sub,
        role: "user",
      });
    } else if (!user.googleId) {
      user.googleId = payload.sub;
      await user.save();
    }

    const token = createToken(user);

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to sign in with Google." });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Email is required." });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res
        .status(404)
        .json({ message: "No user found with that email." });
    }

    if (user.googleId) {
      return res.status(400).json({
        message:
          "Password reset is not supported for Google signed-in users. Please use Google login.",
      });
    }

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    user.resetOtp = otp;
    user.resetOtpExpires = expiresAt;
    await user.save();

    await sendResetOtpEmail(user.email, otp);

    res.json({
      message: "OTP sent to email. It is valid for 15 minutes.",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to send reset OTP." });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword, confirmPassword } = req.body;
    if (!email || !otp || !newPassword || !confirmPassword) {
      return res.status(400).json({
        message: "Email, otp, newPassword, and confirmPassword are required.",
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match." });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    if (user.googleId) {
      return res.status(400).json({
        message:
          "Password reset is not supported for Google signed-in users. Please use Google login.",
      });
    }

    if (!user.resetOtp || user.resetOtp !== otp) {
      return res.status(400).json({ message: "Invalid OTP." });
    }

    if (!user.resetOtpExpires || user.resetOtpExpires < new Date()) {
      return res.status(400).json({ message: "OTP has expired." });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.resetOtp = undefined;
    user.resetOtpExpires = undefined;
    await user.save();

    res.json({ message: "Password has been reset successfully." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to reset password." });
  }
};

exports.getProfile = async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ message: "Not authorized." });
  }

  res.json({
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
    },
  });
};
