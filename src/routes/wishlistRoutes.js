const express = require("express");
const router = express.Router();
const {
  getWishlist,
  addProductToWishlist,
  removeProductFromWishlist,
} = require("../controllers/wishlistController");
const { protect } = require("../middleware/authMiddleware");

router.get("/", protect, getWishlist);
router.post("/", protect, addProductToWishlist);
router.delete("/:productId", protect, removeProductFromWishlist);

module.exports = router;
