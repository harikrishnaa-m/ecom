const ContactUs = require("../models/ContactUs");

exports.createContactUs = async (req, res) => {
  try {
    const { firstName, lastName, email, mobileNumber, requirement } = req.body;

    if (!firstName || !email || !mobileNumber || !requirement) {
      return res.status(400).json({
        message:
          "firstName, email, mobileNumber, and requirement are required.",
      });
    }

    const contact = await ContactUs.create({
      firstName,
      lastName,
      email,
      mobileNumber,
      requirement,
    });

    res.status(201).json({ contact });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to submit contact request." });
  }
};

exports.getContactRequests = async (req, res) => {
  try {
    const contacts = await ContactUs.find().sort({ createdAt: -1 });
    res.json({ contacts });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to fetch contact requests." });
  }
};

exports.getContactRequestById = async (req, res) => {
  try {
    const contact = await ContactUs.findById(req.params.id);
    if (!contact) {
      return res.status(404).json({ message: "Contact request not found." });
    }
    res.json({ contact });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to fetch contact request." });
  }
};
