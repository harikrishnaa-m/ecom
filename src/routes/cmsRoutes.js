const express = require("express");
const router = express.Router();
const {
  getBanners,
  getOffers,
  getAllCmsImages,
  createCmsImage,
  updateCmsImage,
  deleteCmsImage,
} = require("../controllers/cmsController");
const { protect, admin } = require("../middleware/authMiddleware");
const { uploadCmsImage } = require("../middleware/uploadMiddleware");

// Public routes
router.get("/banners", getBanners);
router.get("/offers", getOffers);

// Admin routes
router.get("/", protect, admin, getAllCmsImages);
router.post(
  "/",
  protect,
  admin,
  uploadCmsImage.single("image"),
  createCmsImage,
);
router.patch(
  "/:id",
  protect,
  admin,
  uploadCmsImage.single("image"),
  updateCmsImage,
);
router.delete("/:id", protect, admin, deleteCmsImage);

module.exports = router;
