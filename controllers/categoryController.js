const sharp = require('sharp');
const asyncHandler = require('express-async-handler');

const Category = require('../models/categoryModel');
const factory = require('./handlersFactory');
const { uploadSingleImage } = require('../middlewares/imageUpload');
const cloudinary = require('../config/cloudinary'); // Import your Cloudinary configuration

// Middleware for uploading a single category image
exports.uploadCategoryImage = uploadSingleImage('image');

/**
 * @desc Resizes the uploaded image and uploads it to Cloudinary.
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {Function} next - The next middleware function.
 */
exports.resizeImage = asyncHandler(async (req, res, next) => {
  // If no file is uploaded, skip this middleware
  if (!req.file) {
    console.log('No file uploaded for category. Skipping resize and upload.');
    return next();
  }

  // Define the desired image extension for Cloudinary upload, defaulting to jpeg if not image
  // This is important because sharp's .toFormat() might change the mime type.
  const format = req.file.mimetype.split('/')[1] || 'jpeg';

  // Resize the image in memory to 600x600 pixels and convert to jpeg format with quality 90
  const resizedBuffer = await sharp(req.file.buffer)
    .resize(600, 600)
    .toFormat(format) // Use the detected format or default
    .jpeg({ quality: 90 }) // Apply JPEG quality only if the format is JPEG
    .toBuffer(); // Output the resized image as a buffer

  try {
    // Upload the resized image buffer to Cloudinary
    // We create a data URI from the buffer to upload it directly
    const result = await cloudinary.uploader.upload(
      `data:${req.file.mimetype};base64,${resizedBuffer.toString('base64')}`,
      {
        folder: 'categories', // Store images in a 'categories' folder in Cloudinary
        resource_type: 'image', // Specify that the resource is an image
        // You can add more options here, like quality, transformations, etc.
      }
    );

    // Save the secure URL provided by Cloudinary to req.body.image
    // This URL will be stored in your database
    req.body.image = result.secure_url;
    console.log('Image uploaded to Cloudinary:', req.body.image);
    next();
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    // If upload fails, send a 500 error response
    res.status(500).json({ status: 'error', message: 'Image upload to Cloudinary failed' });
  }
});

/**
 * @desc Helper function to extract the public ID from a Cloudinary URL.
 * The public ID is needed to delete the image from Cloudinary.
 * @param {string} url - The Cloudinary image URL.
 * @returns {string|null} The public ID or null if not found.
 */
const getPublicIdFromCloudinaryUrl = (url) => {
  if (!url) return null; // Handle null or undefined URLs

  const parts = url.split('/');
  const uploadIndex = parts.indexOf('upload');

  // If 'upload' segment is not found, it's not a standard Cloudinary URL
  if (uploadIndex === -1) {
    console.warn(`'upload' segment not found in URL: ${url}`);
    return null;
  }

  // Cloudinary URLs typically have '/upload/v[version_number]/[public_id]' or '/upload/[public_id]'
  // We need to find the segment right after 'upload/' (which could be 'v' or the public ID directly)
  // and then join the remaining parts, removing the file extension.

  // Find the index of the last dot for file extension removal
  const lastDotIndex = parts[parts.length - 1].lastIndexOf('.');

  // Construct the potential public ID path from after 'upload'
  // Skip the 'v' (version) part if it exists (e.g., /v123456789/)
  let publicIdParts = [];
  if (parts[uploadIndex + 1] && parts[uploadIndex + 1].startsWith('v')) {
    publicIdParts = parts.slice(uploadIndex + 2); // Skip 'upload' and 'v[version]'
  } else {
    publicIdParts = parts.slice(uploadIndex + 1); // Skip only 'upload'
  }

  const publicIdWithExtension = publicIdParts.join('/');

  // Remove the file extension if present
  return lastDotIndex !== -1 ? publicIdWithExtension.substring(0, lastDotIndex) : publicIdWithExtension;
};


/**
 * @desc Update specific category
 * @route PUT /api/v1/categories/:id
 * @access Private
 */
exports.updateCategory = asyncHandler(async (req, res, next) => {
  const category = await Category.findById(req.params.id);

  // If category not found, return a 404 error
  if (!category) {
    return res.status(404).json({ message: `No category for this id ${req.params.id}` });
  }

  // IMPORTANT: Remove local file system dependencies (fs and path) as images are now on Cloudinary.
  // The original sanitize image field logic and local file deletion logic are removed.

  // If a new file was uploaded (i.e., resizeImage middleware ran and set req.body.image to the new Cloudinary URL)
  // AND there was an old image URL associated with the category in the database,
  // then delete the old image from Cloudinary.
  // req.file will be present if a new image was uploaded with the update request.
  if (req.file && category.image) {
    const publicId = getPublicIdFromCloudinaryUrl(category.image);
    if (publicId) {
      try {
        await cloudinary.uploader.destroy(publicId);
        console.log(`Old Cloudinary image deleted: ${publicId}`);
      } catch (error) {
        console.error(`Error deleting old Cloudinary image (${publicId}):`, error);
        // It's generally okay to proceed with the update even if old image deletion fails
        // to avoid blocking the user's request. You might want to log this error.
      }
    }
  }

  // Update the category document in the database
  const updatedCategory = await Category.findByIdAndUpdate(req.params.id, req.body, {
    new: true, // Return the modified document rather than the original
    runValidators: true, // Run Mongoose validators on update
  });

  // If update fails (e.g., due to validation errors not caught by runValidators or other issues)
  if (!updatedCategory) {
    // This case might be rare if runValidators is true and Mongoose handles validation,
    // but it's good for robustness.
    return res.status(500).json({ message: 'Category update failed.' });
  }

  // Send the updated category as a response.
  // The 'image' field will now contain the Cloudinary URL directly.
  res.status(200).json({
    status: 'success',
    data: updatedCategory, // Mongoose document will automatically stringify to JSON
  });
});

// CRUD Controllers (using the generic factory functions)
exports.getCategories = factory.getAll(Category);
exports.getCategory = factory.getOne(Category);
exports.createCategory = factory.createOne(Category);
exports.deleteCategory = factory.deleteOne(Category); // This will still only delete from DB.
// To delete from Cloudinary on category deletion,
// you'd need to modify factory.deleteOne
// or override deleteCategory here.
exports.deleteAll = factory.deleteAll(Category);
