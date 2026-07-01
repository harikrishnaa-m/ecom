const express = require("express");
const router = express.Router();
const {
  getCart,
  addItemToCart,
  updateCartItem,
  removeCartItem,
  clearCart,
} = require("../controllers/cartController");
const { protect } = require("../middleware/authMiddleware");

router.get("/", protect, getCart);
router.post("/", protect, addItemToCart);
router.put("/:productId", protect, updateCartItem);
router.delete("/:productId", protect, removeCartItem);
router.delete("/", protect, clearCart);

module.exports = router;
