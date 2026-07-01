const Category = require("../models/Category");
const { uploadCategoryImage } = require("../services/digitalOceanSpaces");

exports.getCategories = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10);
    const requestedLimit = parseInt(req.query.perPage, 10);
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), 20)
      : 20;

    if (!Number.isFinite(page) || page <= 0) {
      const categories = await Category.find({ isActive: true }).populate(
        "parent",
        "name slug",
      );
      return res.json({ categories });
    }

    const total = await Category.countDocuments({ isActive: true });
    const categories = await Category.find({ isActive: true })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("parent", "name slug");

    res.json({
      categories,
      pagination: {
        page,
        perPage: limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to fetch categories." });
  }
};

exports.getCategoryById = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id).populate(
      "parent",
      "name slug",
    );

    if (!category) {
      return res.status(404).json({ message: "Category not found." });
    }

    res.json({ category });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to fetch category." });
  }
};

exports.createCategory = async (req, res) => {
  try {
    const { name, slug, description, parent, metadata, isActive } = req.body;

    if (!name || !slug) {
      return res
        .status(400)
        .json({ message: "Category name and slug are required." });
    }

    const existing = await Category.findOne({ slug });
    if (existing) {
      return res.status(400).json({ message: "Category slug already exists." });
    }

    const imageUrl = req.file
      ? await uploadCategoryImage(req.file)
      : req.body.image;

    const category = await Category.create({
      name,
      slug,
      description,
      parent: parent || null,
      image: imageUrl,
      metadata,
      isActive: typeof isActive === "boolean" ? isActive : true,
    });

    res.status(201).json({ category });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to create category." });
  }
};

exports.updateCategory = async (req, res) => {
  try {
    const updates = {
      name: req.body.name,
      slug: req.body.slug,
      description: req.body.description,
      parent: req.body.parent || null,
      image: req.body.image,
      metadata: req.body.metadata,
      isActive:
        typeof req.body.isActive === "boolean" ? req.body.isActive : undefined,
    };

    if (req.file) {
      updates.image = await uploadCategoryImage(req.file);
    }

    Object.keys(updates).forEach((key) => {
      if (updates[key] === undefined) delete updates[key];
    });

    const category = await Category.findByIdAndUpdate(req.params.id, updates, {
      returnDocument: "after",
      runValidators: true,
    });

    if (!category) {
      return res.status(404).json({ message: "Category not found." });
    }

    res.json({ category });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to update category." });
  }
};

exports.deleteCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ message: "Category not found." });
    }

    await Category.deleteOne({ _id: req.params.id });
    res.json({ message: "Category deleted successfully." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to delete category." });
  }
};
