const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const asyncHandler = require('express-async-handler');
const fs = require('fs');
const path = require('path');

const factory = require('./handlersFactory');
const { uploadSingleImage } = require('../middlewares/imageUpload');
const Brand = require('../models/brandModel');

// Image upload middleware
exports.uploadBrandImage = uploadSingleImage('image');

// Resize image middleware
exports.resizeImage = asyncHandler(async (req, res, next) => {
  if (!req.file) {
    console.log('No file uploaded');
    return next(); // skip resizing if no file is uploaded
  }

  const ext = req.file.mimetype.split('/')[1];
  const filename = `brand-${uuidv4()}-${Date.now()}.${ext}`;

  // Ensure the directory exists
  const dir = path.join(__dirname, '..', 'uploads', 'brands');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  try {
    // Resize and save the image
    await sharp(req.file.buffer)
      .resize(600, 600)
      .toFile(`${dir}/${filename}`);

    req.body.image = filename;
    next();
  } catch (error) {
    console.error('Image resizing error:', error);
    res.status(500).json({ status: 'error', message: 'Image processing failed' });
  }
});

// CRUD Controllers
exports.getBrands = factory.getAll(Brand);
exports.getBrand = factory.getOne(Brand);
exports.createBrand = factory.createOne(Brand);
exports.updateBrand = factory.updateOne(Brand);
exports.deleteBrand = factory.deleteOne(Brand);
exports.deleteAll = factory.deleteAll(Brand);

// const sharp = require('sharp');
// const { v4: uuidv4 } = require('uuid');
// const asyncHandler = require('express-async-handler');

// const factory = require('./handlersFactory');
// const { uploadSingleImage } = require('../middlewares/imageUpload');
// const Brand = require('../models/brandModel');

// exports.uploadBrandImage = uploadSingleImage('image');

// // Resize image
// exports.resizeImage = asyncHandler(async (req, res, next) => {
//   if (!req.file) return next();

//   const ext = req.file.mimetype.split('/')[1];
//   const filename = `brand-${uuidv4()}-${Date.now()}.${ext}`;

//   await sharp(req.file.buffer)
//     .toFile(`uploads/brands/${filename}`); // write into a file on the disk
//   console.log(filename);
//   req.body.image = filename;
//   next();
// });
// exports.getBrands = factory.getAll(Brand);
// exports.getBrand = factory.getOne(Brand);
// exports.createBrand = factory.createOne(Brand);

// exports.updateBrand = factory.updateOne(Brand);

// exports.deleteBrand = factory.deleteOne(Brand);

// exports.deleteAll = factory.deleteAll(Brand);
