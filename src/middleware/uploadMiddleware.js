const multer = require("multer");

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (!file.mimetype.startsWith("image/")) {
    return cb(new Error("Only image files are allowed."), false);
  }
  cb(null, true);
};

exports.uploadCategoryImage = multer({
  storage,
  fileFilter,
});

exports.uploadCmsImage = multer({
  storage,
  fileFilter,
});
