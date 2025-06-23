const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const asyncHandler = require('express-async-handler');
const fs = require('fs');
const path = require('path');

const Category = require('../models/categoryModel');
const factory = require('./handlersFactory');
const { uploadSingleImage } = require('../middlewares/imageUpload');

exports.uploadCategoryImage = uploadSingleImage('image');

exports.resizeImage = asyncHandler(async (req, res, next) => {
  if (!req.file) return next();

  const ext = req.file.mimetype.split('/')[1];
  const filename = `category-${uuidv4()}-${Date.now()}.${ext}`;

  const dir = path.join(__dirname, '..', 'uploads', 'categories');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  await sharp(req.file.buffer)
    .resize(600, 600)
    .toFormat(ext)
    .jpeg({ quality: 90 })
    .toFile(`${dir}/${filename}`);

  req.body.image = filename;
  next();
});

exports.updateCategory = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) {
    return res.status(404).json({ message: 'Category not found' });
  }

  // Sanitize image field if it has full URL
  if (req.body.image && req.body.image.startsWith('http')) {
    req.body.image = req.body.image.replace(/^https?:\/\/[^/]+\/categories\//, '');
  }

  // Delete old image if new image is uploaded
  if (req.body.image && category.image && req.body.image !== category.image) {
    const oldImagePath = path.join(__dirname, '..', 'uploads', 'categories', category.image);
    if (fs.existsSync(oldImagePath)) {
      fs.unlinkSync(oldImagePath);
    }
  }

  const updatedCategory = await Category.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    ...updatedCategory._doc,
    image: updatedCategory.image
      ? `http://127.0.0.1:8000/categories/${updatedCategory.image}`
      : null,
  });
});

// CRUD Controllers
exports.getCategories = factory.getAll(Category);
exports.getCategory = factory.getOne(Category);
exports.createCategory = factory.createOne(Category);
exports.deleteCategory = factory.deleteOne(Category);
exports.deleteAll = factory.deleteAll(Category);

// const sharp = require('sharp'); // image processing lib for nodejs
// const { v4: uuidv4 } = require('uuid');
// const asyncHandler = require('express-async-handler');

// const factory = require('./handlersFactory');
// const { uploadSingleImage } = require('../middlewares/imageUpload');
// const Category = require('../models/categoryModel');

// exports.uploadCategoryImage = uploadSingleImage('image');

// exports.resizeImage = asyncHandler(async (req, res, next) => {
//   if (!req.file) return next();

//   const ext = req.file.mimetype.split('/')[1];
//   const filename = `category-${uuidv4()}-${Date.now()}.${ext}`;

//   await sharp(req.file.buffer)
//     .toFile(`uploads/categories/${filename}`); // write into a file on the disk

//   req.body.image = filename;
//   next();
// });

// exports.getCategories = factory.getAll(Category);

// exports.getCategory = factory.getOne(Category);

// exports.createCategory = factory.createOne(Category);

// exports.updateCategory = factory.updateOne(Category);


// exports.deleteCategory = factory.deleteOne(Category);

// exports.deleteAll = factory.deleteAll(Category);
