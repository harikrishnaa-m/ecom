const express = require("express");
const router = express.Router();
const {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
} = require("../controllers/categoryController");
const { protect, admin } = require("../middleware/authMiddleware");
const { uploadCategoryImage } = require("../middleware/uploadMiddleware");

router.get("/", getCategories);
router.get("/:id", getCategoryById);
router.post(
  "/",
  protect,
  admin,
  uploadCategoryImage.single("image"),
  createCategory,
);
router.put(
  "/:id",
  protect,
  admin,
  uploadCategoryImage.single("image"),
  updateCategory,
);
router.delete("/:id", protect, admin, deleteCategory);

module.exports = router;
