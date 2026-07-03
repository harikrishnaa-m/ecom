const Product = require("../models/Product");
const { uploadCategoryImage } = require("../services/digitalOceanSpaces");

const buildProductPayload = async (body, files) => {
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
    attributes: body.attributes
      ? typeof body.attributes === "string"
        ? JSON.parse(body.attributes)
        : body.attributes
      : {},
    collectionName: body.collectionName,
    availability: body.availability,
    startingPrice: body.startingPrice ? Number(body.startingPrice) : undefined,
    productInformation: body.productInformation
      ? typeof body.productInformation === "string"
        ? JSON.parse(body.productInformation)
        : body.productInformation
      : undefined,
    technicalDetails: body.technicalDetails
      ? typeof body.technicalDetails === "string"
        ? JSON.parse(body.technicalDetails)
        : body.technicalDetails
      : {
          height: body.height,
          width: body.width,
          bandThickness: body.bandThickness,
          centerStone: body.centerStone,
          diamondWeight: body.diamondWeight,
          metalWeight: body.metalWeight,
          goldPurity: body.goldPurity,
          finish: body.finish,
        },
    schematicImage: body.schematicImage,
    additionalInformation: body.additionalInformation
      ? typeof body.additionalInformation === "string"
        ? JSON.parse(body.additionalInformation)
        : body.additionalInformation
      : {
          category: body.additionalCategory,
          occasion: body.additionalOccasion,
          collection: body.additionalCollection,
          manufacturing: body.additionalManufacturing,
        },
    isFeatured: body.isFeatured === "true" || body.isFeatured === true,
    isActive: body.isActive === "false" ? false : body.isActive !== "false",
    metadata: body.metadata
      ? typeof body.metadata === "string"
        ? JSON.parse(body.metadata)
        : body.metadata
      : {},
  };

  if (files?.image?.length) {
    payload.image = await uploadCategoryImage(files.image[0]);
  }

  if (files?.images?.length) {
    const extraImages = await Promise.all(
      files.images.map((imageFile) => uploadCategoryImage(imageFile)),
    );
    payload.images = payload.images.concat(extraImages);
  }

  if (files?.schematicImage?.length) {
    payload.schematicImage = await uploadCategoryImage(files.schematicImage[0]);
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

exports.getProductsByCategory = async (req, res) => {
  try {
    const categoryId = req.params.categoryId;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = 12;

    const filter = {
      isActive: true,
      category: categoryId,
    };

    const total = await Product.countDocuments(filter);
    const products = await Product.find(filter)
      .populate("category", "name slug")
      .sort({ createdAt: -1 })
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
    res.status(500).json({ message: "Unable to fetch products by category." });
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
    const payload = await buildProductPayload(req.body, req.files);

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
    const payload = await buildProductPayload(req.body, req.files);

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
