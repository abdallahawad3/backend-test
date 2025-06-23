const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const asyncHandler = require('express-async-handler');
const multer = require('multer');

const ApiError = require('../utils/apiError');
const Product = require('../models/productModel');
const factory = require('./handlersFactory');
const cloudinary = require('../config/cloudinary'); // adjust path if needed

// -------------------
// Multer Setup
// -------------------

const multerStorage = multer.memoryStorage();

const multerFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image')) {
    cb(null, true);
  } else {
    cb(new ApiError('Only image files are allowed!', 400), false);
  }
};

const upload = multer({ storage: multerStorage, fileFilter: multerFilter });

exports.uploadProductImages = upload.fields([
  { name: 'imageCover', maxCount: 1 },
  { name: 'images', maxCount: 5 },
]);

// -------------------
// Cloudinary Upload Helper
// -------------------

const streamUpload = (buffer, filename, folder) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: filename.split('.')[0],
      },
      (error, result) => {
        if (result) resolve(result);
        else reject(error);
      }
    );
    stream.end(buffer);
  });

// -------------------
// Resize & Upload to Cloudinary
// -------------------

exports.resizeProductImages = asyncHandler(async (req, res, next) => {
  // Process imageCover
  if (req.files.imageCover) {
    const ext = req.files.imageCover[0].mimetype.split('/')[1];
    const imageCoverFilename = `products-${uuidv4()}-${Date.now()}-cover.${ext}`;

    const imageCoverBuffer = await sharp(req.files.imageCover[0].buffer)
      // .resize(2000, 1333)
      // .toFormat('jpeg')
      // .jpeg({ quality: 90 })
      .toBuffer();

    const result = await streamUpload(imageCoverBuffer, imageCoverFilename, 'products');
    req.body.imageCover = result.secure_url;
  }

  req.body.images = [];

  // Process multiple images
  if (req.files.images) {
    await Promise.all(
      req.files.images.map(async (img, index) => {
        const ext = img.mimetype.split('/')[1];
        const filename = `products-${uuidv4()}-${Date.now()}-${index + 1}.${ext}`;

        const imageBuffer = await sharp(img.buffer)
          // .resize(800, 800)
          // .toFormat('jpeg')
          // .jpeg({ quality: 90 })
          .toBuffer();

        const result = await streamUpload(imageBuffer, filename, 'products');
        req.body.images.push(result.secure_url);
      })
    );
  }

  next();
});

// -------------------
// CRUD Controllers
// -------------------

// @desc      Get all products
// @route     GET /api/v1/products
// @access    Public
exports.getProducts = factory.getAll(Product, 'Products');

// @desc      Get specific product by id
// @route     GET /api/v1/products/:id
// @access    Public
exports.getProduct = factory.getOne(Product, 'reviews');

// @desc      Create product
// @route     POST /api/v1/products
// @access    Private
exports.createProduct = factory.createOne(Product);

// @desc      Update product
// @route     PATCH /api/v1/products/:id
// @access    Private
exports.updateProduct = factory.updateOne(Product);

// @desc     Delete product
// @route    DELETE /api/v1/products/:id
// @access   Private
exports.deleteProduct = factory.deleteOne(Product);
