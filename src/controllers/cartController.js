const Cart = require("../models/Cart");
const Product = require("../models/Product");

exports.getCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id }).populate(
      "items.product",
      "name slug price image stock",
    );

    if (!cart) {
      return res.json({ items: [] });
    }

    res.json({ items: cart.items });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to fetch cart." });
  }
};

exports.addItemToCart = async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    if (!productId || !quantity || Number(quantity) <= 0) {
      return res
        .status(400)
        .json({ message: "productId and positive quantity are required." });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found." });
    }

    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      cart = await Cart.create({
        user: req.user._id,
        items: [{ product: product._id, quantity: Number(quantity) }],
      });
    } else {
      const itemIndex = cart.items.findIndex((item) =>
        item.product.equals(product._id),
      );

      if (itemIndex >= 0) {
        cart.items[itemIndex].quantity += Number(quantity);
      } else {
        cart.items.push({ product: product._id, quantity: Number(quantity) });
      }
      await cart.save();
    }

    await cart.populate("items.product", "name slug price image stock");
    res.status(201).json({ items: cart.items });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to add item to cart." });
  }
};

exports.updateCartItem = async (req, res) => {
  try {
    const { quantity } = req.body;
    const { productId } = req.params;

    if (quantity == null || Number(quantity) <= 0) {
      return res
        .status(400)
        .json({ message: "Quantity must be a positive number." });
    }

    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      return res.status(404).json({ message: "Cart not found." });
    }

    const item = cart.items.find((item) => item.product.equals(productId));
    if (!item) {
      return res.status(404).json({ message: "Product not found in cart." });
    }

    item.quantity = Number(quantity);
    await cart.save();

    await cart.populate("items.product", "name slug price image stock");
    res.json({ items: cart.items });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to update cart item." });
  }
};

exports.removeCartItem = async (req, res) => {
  try {
    const { productId } = req.params;
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      return res.status(404).json({ message: "Cart not found." });
    }

    const originalLength = cart.items.length;
    cart.items = cart.items.filter((item) => !item.product.equals(productId));

    if (cart.items.length === originalLength) {
      return res.status(404).json({ message: "Product not found in cart." });
    }

    await cart.save();
    await cart.populate("items.product", "name slug price image stock");
    res.json({ items: cart.items });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to remove cart item." });
  }
};

exports.clearCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id });
    if (cart) {
      cart.items = [];
      await cart.save();
    }
    res.json({ items: [] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to clear cart." });
  }
};
