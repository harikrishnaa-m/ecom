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

const uploadProductImages = uploadCategoryImage.fields([
  { name: "image", maxCount: 1 },
  { name: "images", maxCount: 10 },
]);

router.get("/", listProducts);
router.get("/low-stock", protect, admin, getLowStockProducts);
router.get("/:id", getProductById);
router.post("/", protect, admin, uploadProductImages, createProduct);
router.put("/:id", protect, admin, uploadProductImages, updateProduct);
router.patch("/:id/stock", protect, admin, updateProductStock);
router.delete("/:id", protect, admin, deleteProduct);

module.exports = router;
