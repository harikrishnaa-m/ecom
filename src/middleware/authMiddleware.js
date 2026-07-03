const jwt = require("jsonwebtoken");
const User = require("../models/User");

exports.protect = async (req, res, next) => {
  let token;

  if (
    typeof req.headers.authorization === "string" &&
    req.headers.authorization.startsWith("Bearer ")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return res
      .status(401)
      .json({ message: "Not authorized, no token provided." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select("-password");

    if (!user) {
      return res
        .status(401)
        .json({ message: "Not authorized, user not found." });
    }

    req.user = user;
    next();
  } catch (error) {
    const message =
      error.name === "TokenExpiredError"
        ? "Not authorized, token expired."
        : "Not authorized, token invalid.";
    console.warn(`Auth failure: ${error.name} - ${error.message}`);
    return res.status(401).json({ message });
  }
};

exports.admin = (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required." });
  }

  next();
};
