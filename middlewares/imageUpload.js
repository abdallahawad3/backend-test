// const multer = require('multer');

// const ApiError = require('../utils/apiError');

// // Upload single image => method return multer middleware
// exports.uploadSingleImage = (fieldName) => {
//   // Storage
//   const multerStorage = multer.memoryStorage();

//   // Accept only images
//   const multerFilter = (req, file, cb) => {
//     if (file.mimetype.startsWith('image')) {
//       cb(null, true);
//     } else {
//       cb(new ApiError('only images allowed', 400), false);
//     }
//   };

//   const upload = multer({ storage: multerStorage, fileFilter: multerFilter });

//   return upload.single(fieldName);
// };
const multer = require('multer');

// Use memory storage because sharp needs buffer
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

// Utility to create a single image uploader
exports.uploadSingleImage = (fieldName) => multer({ storage, fileFilter }).single(fieldName);
