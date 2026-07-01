const Wishlist = require("../models/Wishlist");
const Product = require("../models/Product");

exports.getWishlist = async (req, res) => {
  try {
    const wishlist = await Wishlist.findOne({ user: req.user._id }).populate(
      "products.product",
      "name slug price image stock",
    );

    if (!wishlist) {
      return res.json({ products: [] });
    }

    res.json({ products: wishlist.products });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to fetch wishlist." });
  }
};

exports.addProductToWishlist = async (req, res) => {
  try {
    const { productId } = req.body;
    if (!productId) {
      return res.status(400).json({ message: "productId is required." });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found." });
    }

    let wishlist = await Wishlist.findOne({ user: req.user._id });
    if (!wishlist) {
      wishlist = await Wishlist.create({
        user: req.user._id,
        products: [{ product: product._id }],
      });
    } else {
      const exists = wishlist.products.some((item) =>
        item.product.equals(product._id),
      );
      if (exists) {
        return res
          .status(400)
          .json({ message: "Product already in wishlist." });
      }
      wishlist.products.push({ product: product._id });
      await wishlist.save();
    }

    await wishlist.populate("products.product", "name slug price image stock");
    res.status(201).json({ products: wishlist.products });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to add product to wishlist." });
  }
};

exports.removeProductFromWishlist = async (req, res) => {
  try {
    const { productId } = req.params;
    const wishlist = await Wishlist.findOne({ user: req.user._id });
    if (!wishlist) {
      return res.status(404).json({ message: "Wishlist not found." });
    }

    const originalCount = wishlist.products.length;
    wishlist.products = wishlist.products.filter(
      (item) => !item.product.equals(productId),
    );

    if (wishlist.products.length === originalCount) {
      return res
        .status(404)
        .json({ message: "Product not found in wishlist." });
    }

    await wishlist.save();
    await wishlist.populate("products.product", "name slug price image stock");
    res.json({ products: wishlist.products });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Unable to remove product from wishlist." });
  }
};
