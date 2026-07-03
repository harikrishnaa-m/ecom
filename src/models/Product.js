const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    discountPrice: {
      type: Number,
      min: 0,
    },
    sku: {
      type: String,
      trim: true,
    },
    collectionName: {
      type: String,
      trim: true,
    },
    availability: {
      type: String,
      trim: true,
    },
    startingPrice: {
      type: Number,
      min: 0,
    },
    productInformation: {
      metal: { type: String, trim: true },
      diamond: { type: String, trim: true },
      shape: { type: String, trim: true },
      certification: { type: String, trim: true },
      additional: { type: mongoose.Schema.Types.Mixed, default: {} },
    },
    technicalDetails: {
      height: { type: String, trim: true },
      width: { type: String, trim: true },
      bandThickness: { type: String, trim: true },
      centerStone: { type: String, trim: true },
      diamondWeight: { type: String, trim: true },
      metalWeight: { type: String, trim: true },
      goldPurity: { type: String, trim: true },
      finish: { type: String, trim: true },
    },
    schematicImage: {
      type: String,
      trim: true,
    },
    additionalInformation: {
      category: { type: String, trim: true },
      occasion: { type: String, trim: true },
      collection: { type: String, trim: true },
      manufacturing: { type: String, trim: true },
      extra: { type: mongoose.Schema.Types.Mixed, default: {} },
    },
    stock: {
      type: Number,
      default: 0,
      min: 0,
    },
    brand: {
      type: String,
      trim: true,
    },
    weight: {
      type: Number,
      min: 0,
    },
    dimensions: {
      width: { type: Number, min: 0 },
      height: { type: Number, min: 0 },
      depth: { type: Number, min: 0 },
    },
    image: {
      type: String,
      trim: true,
    },
    images: {
      type: [String],
      default: [],
    },
    tags: {
      type: [String],
      default: [],
    },
    attributes: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    metadata: {
      title: { type: String, trim: true },
      keywords: { type: [String], default: [] },
      description: { type: String, trim: true },
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Product", productSchema);
