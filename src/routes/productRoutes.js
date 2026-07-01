const express = require("express");
const router = express.Router();
const {
  listProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  updateProductStock,
  getLowStockProducts,
} = require("../controllers/productController");
const { protect, admin } = require("../middleware/authMiddleware");
const { uploadCategoryImage } = require("../middleware/uploadMiddleware");

router.get("/", listProducts);
router.get("/low-stock", protect, admin, getLowStockProducts);
router.get("/:id", getProductById);
router.post(
  "/",
  protect,
  admin,
  uploadCategoryImage.single("image"),
  createProduct,
);
router.put(
  "/:id",
  protect,
  admin,
  uploadCategoryImage.single("image"),
  updateProduct,
);
router.patch("/:id/stock", protect, admin, updateProductStock);
router.delete("/:id", protect, admin, deleteProduct);

module.exports = router;
