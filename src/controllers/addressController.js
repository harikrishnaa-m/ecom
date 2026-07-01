const Address = require("../models/Address");

exports.listAddresses = async (req, res) => {
  try {
    const addresses = await Address.find({ user: req.user._id }).sort({
      isDefault: -1,
      updatedAt: -1,
    });
    res.json({ addresses });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to fetch addresses." });
  }
};

exports.getAddressById = async (req, res) => {
  try {
    const address = await Address.findOne({
      _id: req.params.id,
      user: req.user._id,
    });
    if (!address) {
      return res.status(404).json({ message: "Address not found." });
    }
    res.json({ address });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to fetch address." });
  }
};

const unsetDefaultAddresses = async (userId) => {
  await Address.updateMany(
    { user: userId, isDefault: true },
    { isDefault: false },
  );
};

exports.createAddress = async (req, res) => {
  try {
    const {
      label,
      fullName,
      phone,
      line1,
      line2,
      city,
      state,
      postalCode,
      country,
      isDefault,
    } = req.body;

    if (
      !fullName ||
      !phone ||
      !line1 ||
      !city ||
      !state ||
      !postalCode ||
      !country
    ) {
      return res
        .status(400)
        .json({ message: "All required address fields must be provided." });
    }

    if (isDefault) {
      await unsetDefaultAddresses(req.user._id);
    }

    const address = await Address.create({
      user: req.user._id,
      label,
      fullName,
      phone,
      line1,
      line2,
      city,
      state,
      postalCode,
      country,
      isDefault: Boolean(isDefault),
    });

    res.status(201).json({ address });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to create address." });
  }
};

exports.updateAddress = async (req, res) => {
  try {
    const updates = req.body;
    if (updates.isDefault) {
      await unsetDefaultAddresses(req.user._id);
    }

    const address = await Address.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      updates,
      { new: true, runValidators: true },
    );

    if (!address) {
      return res.status(404).json({ message: "Address not found." });
    }

    res.json({ address });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to update address." });
  }
};

exports.deleteAddress = async (req, res) => {
  try {
    const address = await Address.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    });
    if (!address) {
      return res.status(404).json({ message: "Address not found." });
    }
    res.json({ message: "Address deleted successfully." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to delete address." });
  }
};
