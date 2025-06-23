const multer = require('multer');

// Use memory storage for direct Cloudinary upload
const storage = multer.memoryStorage();

// Accept only images
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

const upload = multer({ storage, fileFilter });

// For uploading a single image
exports.uploadSingleImage = (fieldName) => upload.single(fieldName);

// For uploading multiple images (same field)
exports.uploadMultipleImages = (fieldName, maxCount = 5) =>
  upload.array(fieldName, maxCount);

// For uploading fields like imageCover (1), images (multiple)
exports.uploadMixedImages = (fieldsConfig = [
  { name: 'imageCover', maxCount: 1 },
  { name: 'images', maxCount: 5 }
]) => upload.fields(fieldsConfig);
