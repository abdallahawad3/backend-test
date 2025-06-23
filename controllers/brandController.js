const sharp = require('sharp');
const asyncHandler = require('express-async-handler');

const factory = require('./handlersFactory');
const { uploadSingleImage } = require('../middlewares/imageUpload');
const Brand = require('../models/brandModel');
const cloudinary = require('../config/cloudinary'); // Assuming your cloudinary config is in utils/cloudinary.js

// Image upload middleware
exports.uploadBrandImage = uploadSingleImage('image');

// Resize and upload image to Cloudinary middleware
exports.resizeImage = asyncHandler(async (req, res, next) => {
  if (!req.file) {
    console.log('No file uploaded');
    return next(); // skip resizing if no file is uploaded
  }

  // Resize image in memory
  const resizedBuffer = await sharp(req.file.buffer)
    .resize(600, 600)
    .toBuffer();

  try {
    // Upload image to Cloudinary
    const result = await cloudinary.uploader.upload(
      `data:${req.file.mimetype};base64,${resizedBuffer.toString('base64')}`,
      {
        folder: 'brands', // Optional: organize your images in a 'brands' folder in Cloudinary
        resource_type: 'image',
      }
    );

    // Save the Cloudinary image URL to req.body.image
    req.body.image = result.secure_url;
    next();
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    res.status(500).json({ status: 'error', message: 'Image upload to Cloudinary failed' });
  }
});

// CRUD Controllers
exports.getBrands = factory.getAll(Brand);
exports.getBrand = factory.getOne(Brand);
exports.createBrand = factory.createOne(Brand);
exports.updateBrand = factory.updateOne(Brand);
exports.deleteBrand = factory.deleteOne(Brand);
exports.deleteAll = factory.deleteAll(Brand);