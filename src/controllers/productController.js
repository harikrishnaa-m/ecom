const Product = require("../models/Product");
const { uploadCategoryImage } = require("../services/digitalOceanSpaces");

const buildProductPayload = async (body, file) => {
  const payload = {
    name: body.name,
    slug: body.slug,
    description: body.description,
    category: body.category,
    price: Number(body.price),
    discountPrice: body.discountPrice ? Number(body.discountPrice) : undefined,
    sku: body.sku,
    stock: body.stock ? Number(body.stock) : undefined,
    brand: body.brand,
    weight: body.weight ? Number(body.weight) : undefined,
    dimensions: body.dimensions,
    image: body.image,
    images: body.images
      ? Array.isArray(body.images)
        ? body.images
        : [body.images]
      : [],
    tags: body.tags ? (Array.isArray(body.tags) ? body.tags : [body.tags]) : [],
    attributes: body.attributes ? JSON.parse(body.attributes) : {},
    isFeatured: body.isFeatured === "true" || body.isFeatured === true,
    isActive: body.isActive === "false" ? false : body.isActive !== "false",
    metadata: body.metadata ? JSON.parse(body.metadata) : {},
  };

  if (file) {
    payload.image = await uploadCategoryImage(file);
  }

  Object.keys(payload).forEach((key) => {
    if (payload[key] === undefined) delete payload[key];
  });

  return payload;
};

exports.listProducts = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10);
    const requestedLimit = parseInt(req.query.perPage, 10);
    const search = req.query.search;

    const filter = { isActive: true };
    if (search) {
      const regex = new RegExp(search.trim(), "i");
      filter.$or = [
        { name: regex },
        { slug: regex },
        { description: regex },
        { sku: regex },
        { brand: regex },
      ];
    }

    const sort = req.query.sort;
    const sortOrder =
      sort === "price_desc" ? -1 : sort === "price_asc" ? 1 : -1;
    const sortField = sort && sort.startsWith("price_") ? "price" : "createdAt";

    const hasPagination = Number.isFinite(page) && page > 0;
    if (!hasPagination) {
      const products = await Product.find(filter)
        .populate("category", "name slug")
        .sort({ [sortField]: sortField === "price" ? sortOrder : -1 });

      return res.json({ products });
    }

    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), 20)
      : 20;
    const total = await Product.countDocuments(filter);
    const products = await Product.find(filter)
      .populate("category", "name slug")
      .sort({ [sortField]: sortField === "price" ? sortOrder : -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({
      products,
      pagination: {
        page,
        perPage: limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to fetch products." });
  }
};

exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate(
      "category",
      "name slug",
    );

    if (!product) {
      return res.status(404).json({ message: "Product not found." });
    }

    res.json({ product });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to fetch product." });
  }
};

exports.createProduct = async (req, res) => {
  try {
    const payload = await buildProductPayload(req.body, req.file);

    if (
      !payload.name ||
      !payload.slug ||
      !payload.category ||
      payload.price == null
    ) {
      return res.status(400).json({
        message: "name, slug, category, and price are required fields.",
      });
    }

    const existing = await Product.findOne({ slug: payload.slug });
    if (existing) {
      return res.status(400).json({ message: "Product slug already exists." });
    }

    const product = await Product.create(payload);
    res.status(201).json({ product });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to create product." });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const payload = await buildProductPayload(req.body, req.file);

    const product = await Product.findByIdAndUpdate(req.params.id, payload, {
      returnDocument: "after",
      runValidators: true,
    });

    if (!product) {
      return res.status(404).json({ message: "Product not found." });
    }

    res.json({ product });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to update product." });
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found." });
    }

    await Product.deleteOne({ _id: req.params.id });
    res.json({ message: "Product deleted successfully." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to delete product." });
  }
};

exports.updateProductStock = async (req, res) => {
  try {
    const stockValue = req.body.stock;
    if (stockValue == null || isNaN(Number(stockValue))) {
      return res
        .status(400)
        .json({ message: "A numeric stock value is required." });
    }

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { stock: Number(stockValue) },
      { returnDocument: "after", runValidators: true },
    );

    if (!product) {
      return res.status(404).json({ message: "Product not found." });
    }

    res.json({ product });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to update product stock." });
  }
};

exports.getLowStockProducts = async (req, res) => {
  try {
    const search = req.query.search;
    const filter = {
      isActive: true,
      stock: { $lt: 10 },
    };

    if (search) {
      const regex = new RegExp(search.trim(), "i");
      filter.$or = [
        { name: regex },
        { slug: regex },
        { description: regex },
        { sku: regex },
        { brand: regex },
      ];
    }

    const products = await Product.find(filter)
      .populate("category", "name slug")
      .sort({ stock: 1, createdAt: -1 });

    res.json({ products });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to fetch low stock products." });
  }
};
