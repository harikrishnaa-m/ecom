const mongoose = require("mongoose");

const cmsImageSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      trim: true,
      required: true,
    },
    imageUrl: {
      type: String,
      trim: true,
      required: true,
    },
    imageType: {
      type: String,
      enum: ["banner", "offer"],
      required: true,
    },
    isVisible: {
      type: Boolean,
      default: true,
    },
    order: {
      type: Number,
      default: 0,
    },
    link: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("CmsImage", cmsImageSchema);
