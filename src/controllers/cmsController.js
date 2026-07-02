const CmsImage = require("../models/CmsImage");
const { uploadCmsImage } = require("../services/digitalOceanSpaces");

exports.getBanners = async (req, res) => {
  try {
    const banners = await CmsImage.find({
      imageType: "banner",
      isVisible: true,
    }).sort({ order: 1, createdAt: -1 });
    res.json({ banners });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to fetch banners." });
  }
};

exports.getOffers = async (req, res) => {
  try {
    const offers = await CmsImage.find({
      imageType: "offer",
      isVisible: true,
    }).sort({ order: 1, createdAt: -1 });
    res.json({ offers });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to fetch offers." });
  }
};

exports.getAllCmsImages = async (req, res) => {
  try {
    const filter = {};
    if (req.query.imageType) {
      if (!["banner", "offer"].includes(req.query.imageType)) {
        return res.status(400).json({ message: "Invalid imageType filter." });
      }
      filter.imageType = req.query.imageType;
    }
    const images = await CmsImage.find(filter).sort({
      order: 1,
      createdAt: -1,
    });
    res.json({ images });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to fetch CMS images." });
  }
};

exports.createCmsImage = async (req, res) => {
  try {
    const { title, imageType, isVisible, order, link } = req.body;

    if (!title || !imageType) {
      return res
        .status(400)
        .json({ message: "title and imageType are required." });
    }

    if (!["banner", "offer"].includes(imageType)) {
      return res
        .status(400)
        .json({ message: "imageType must be banner or offer." });
    }

    if (!req.file) {
      return res.status(400).json({ message: "Image file is required." });
    }

    const imageUrl = await uploadCmsImage(req.file);

    const cmsImage = await CmsImage.create({
      title,
      imageUrl,
      imageType,
      isVisible: isVisible !== undefined ? isVisible : true,
      order: order || 0,
      link,
    });

    res.status(201).json({ cmsImage });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to create CMS image." });
  }
};

exports.updateCmsImage = async (req, res) => {
  try {
    const cmsImage = await CmsImage.findById(req.params.id);
    if (!cmsImage) {
      return res.status(404).json({ message: "CMS image not found." });
    }

    const { title, imageType, isVisible, order, link } = req.body;

    if (imageType && !["banner", "offer"].includes(imageType)) {
      return res
        .status(400)
        .json({ message: "imageType must be banner or offer." });
    }

    if (req.file) {
      cmsImage.imageUrl = await uploadCmsImage(req.file);
    }

    if (title !== undefined) cmsImage.title = title;
    if (imageType !== undefined) cmsImage.imageType = imageType;
    if (isVisible !== undefined) cmsImage.isVisible = isVisible;
    if (order !== undefined) cmsImage.order = order;
    if (link !== undefined) cmsImage.link = link;

    await cmsImage.save();
    res.json({ cmsImage });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to update CMS image." });
  }
};

exports.deleteCmsImage = async (req, res) => {
  try {
    const cmsImage = await CmsImage.findByIdAndDelete(req.params.id);
    if (!cmsImage) {
      return res.status(404).json({ message: "CMS image not found." });
    }
    res.json({ message: "CMS image deleted." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to delete CMS image." });
  }
};
