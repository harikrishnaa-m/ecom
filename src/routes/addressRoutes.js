const express = require("express");
const router = express.Router();
const {
  listAddresses,
  getAddressById,
  createAddress,
  updateAddress,
  deleteAddress,
} = require("../controllers/addressController");
const { protect } = require("../middleware/authMiddleware");

router.get("/", protect, listAddresses);
router.get("/:id", protect, getAddressById);
router.post("/", protect, createAddress);
router.put("/:id", protect, updateAddress);
router.delete("/:id", protect, deleteAddress);

module.exports = router;
