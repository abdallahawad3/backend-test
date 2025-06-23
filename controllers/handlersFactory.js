const asyncHandler = require('express-async-handler');
const ApiError = require('../utils/apiError');
const ApiFeatures = require('../utils/apiFeatures');
const cloudinary = require('../config/cloudinary'); // Import your Cloudinary configuration

/**
 * @desc Helper function to extract the public ID from a Cloudinary URL.
 * The public ID is needed to delete the image from Cloudinary.
 * This function is duplicated here for self-containment, but ideally,
 * it would live in a shared utility file if used across multiple modules.
 * @param {string} url - The Cloudinary image URL.
 * @returns {string|null} The public ID or null if not found.
 */
const getPublicIdFromCloudinaryUrl = (url) => {
  if (!url) return null;

  const parts = url.split('/');
  const uploadIndex = parts.indexOf('upload');

  if (uploadIndex === -1) {
    console.warn(`'upload' segment not found in URL: ${url}`);
    return null;
  }

  let publicIdParts = [];
  if (parts[uploadIndex + 1] && parts[uploadIndex + 1].startsWith('v')) {
    publicIdParts = parts.slice(uploadIndex + 2);
  } else {
    publicIdParts = parts.slice(uploadIndex + 1);
  }

  const publicIdWithExtension = publicIdParts.join('/');
  const lastDotIndex = publicIdWithExtension.lastIndexOf('.');
  return lastDotIndex !== -1 ? publicIdWithExtension.substring(0, lastDotIndex) : publicIdWithExtension;
};

// This function seems to be specific to 'Product' model for setting image URLs.
// It will remain as is since the query is about deleteOne.
const setImageUrl = (doc) => {
  if (doc.imageCover) {
    const imageCoverUrl = `${process.env.BASE_URL}/products/${doc.imageCover}`;
    doc.imageCover = imageCoverUrl;
  }
  if (doc.images) {
    const images = [];
    doc.images.forEach((image) => {
      const imageUrl = `${process.env.BASE_URL}/products/${image}`;
      images.push(imageUrl);
    });
    doc.images = images;
  }
};

/**
 * @desc Generic delete one document handler.
 * Includes logic to delete associated images from Cloudinary if present.
 * @param {Mongoose.Model} Model - The Mongoose model.
 * @returns {Function} An Express middleware function.
 */
exports.deleteOne = (Model) =>
  asyncHandler(async (req, res, next) => {
    const document = await Model.findByIdAndDelete(req.params.id);

    if (!document) {
      return next(
        new ApiError(`No document found for this id: ${req.params.id}`, 404)
      );
    }

    // Check if the document has an 'image' field (e.g., for Category or Brand)
    // or 'imageCover'/'images' fields (e.g., for Product) and delete from Cloudinary.
    if (document.image) {
      const publicId = getPublicIdFromCloudinaryUrl(document.image);
      if (publicId) {
        try {
          await cloudinary.uploader.destroy(publicId);
          console.log(`Cloudinary image deleted for document ${document._id}: ${publicId}`);
        } catch (error) {
          console.error(`Error deleting Cloudinary image (${publicId}) for document ${document._id}:`, error);
        }
      }
    }

    // Handle imageCover and images for Product model if applicable
    if (document.constructor.modelName === 'Product') {
      if (document.imageCover) {
        const publicId = getPublicIdFromCloudinaryUrl(document.imageCover);
        if (publicId) {
          try {
            await cloudinary.uploader.destroy(publicId);
            console.log(`Cloudinary imageCover deleted for product ${document._id}: ${publicId}`);
          } catch (error) {
            console.error(`Error deleting Cloudinary imageCover (${publicId}) for product ${document._id}:`, error);
          }
        }
      }
      if (document.images && document.images.length > 0) {
        await Promise.all(
          document.images.map(async (imgUrl) => {
            const publicId = getPublicIdFromCloudinaryUrl(imgUrl);
            if (publicId) {
              try {
                await cloudinary.uploader.destroy(publicId);
                console.log(`Cloudinary image deleted for product ${document._id}: ${publicId}`);
              } catch (error) {
                console.error(`Error deleting Cloudinary image (${publicId}) for product ${document._id}:`, error);
              }
            }
          })
        );
      }
    }

    // 204 no content
    res.status(204).send();
  });

/**
 * @desc Generic update one document handler.
 * @param {Mongoose.Model} Model - The Mongoose model.
 * @returns {Function} An Express middleware function.
 */
exports.updateOne = (Model) =>
  asyncHandler(async (req, res, next) => {
    // Note: Image deletion for update operations is typically handled in specific controllers
    // (e.g., categoryController.js or productController.js) where `req.file` is available
    // and the old image URL from the document is known before the update.
    const document = await Model.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!document) {
      return next(
        new ApiError(`No document found for this id: ${req.params.id}`, 404)
      );
    }

    // To trigger 'save' event when update document
    // This `save()` call can be redundant if `findByIdAndUpdate` handles everything.
    // If you have pre/post save hooks on your schema, this is where they'd be triggered.
    const doc = await document.save();

    if (doc.constructor.modelName === 'Product') {
      setImageUrl(doc);
    }
    res.status(200).json({ data: doc });
  });

/**
 * @desc Generic create one document handler.
 * @param {Mongoose.Model} Model - The Mongoose model.
 * @returns {Function} An Express middleware function.
 */
exports.createOne = (Model) =>
  asyncHandler(async (req, res) => {
    const newDoc = await Model.create(req.body);

    if (newDoc.constructor.modelName === 'Product') {
      setImageUrl(newDoc);
    }
    res.status(201).json({ data: newDoc });
  });

/**
 * @desc Generic get one document handler.
 * @param {Mongoose.Model} Model - The Mongoose model.
 * @param {Object} [populateOpts] - Options for Mongoose populate.
 * @returns {Function} An Express middleware function.
 */
exports.getOne = (Model, populateOpts) =>
  asyncHandler(async (req, res, next) => {
    const { id } = req.params;
    // Build query
    let query = Model.findById(id);
    if (populateOpts) query = query.populate(populateOpts);

    // Execute query
    const document = await query;

    if (!document) {
      return next(new ApiError(`No document for this id ${id}`, 404));
    }

    if (document.constructor.modelName === 'Product') {
      setImageUrl(document);
    }
    res.status(200).json({ data: document });
  });

/**
 * @desc Generic get all documents handler.
 * @param {Mongoose.Model} Model - The Mongoose model.
 * @param {string} [modelName=''] - The name of the model for search functionality.
 * @returns {Function} An Express middleware function.
 */
exports.getAll = (Model, modelName = '') =>
  asyncHandler(async (req, res) => {
    let filter = {};
    if (req.filterObject) {
      filter = req.filterObject;
    }

    // Apply pagination after filter and search
    const apiFeatures = new ApiFeatures(Model.find(filter), req.query)
      .filter()
      .search(modelName)
      .limitFields()
      .sort();

    const docsCount = await Model.countDocuments(apiFeatures.mongooseQuery);
    apiFeatures.paginate(docsCount);

    // Execute query
    const { mongooseQuery, paginationResult } = apiFeatures;
    const documents = await mongooseQuery;

    // Set Images url for products
    if (Model.collection.collectionName === 'products') {
      documents.forEach((doc) => setImageUrl(doc));
    }
    res
      .status(200)
      .json({ results: docsCount, paginationResult, data: documents });
  });

/**
 * @desc Generic delete all documents handler.
 * NOTE: This currently does NOT delete images from Cloudinary for all documents.
 * Implementing that would require iterating through all documents before deletion.
 * @param {Mongoose.Model} Model - The Mongoose model.
 * @returns {Function} An Express middleware function.
 */
exports.deleteAll = (Model) =>
  asyncHandler(async (req, res, next) => {
    // WARNING: This deleteAll does NOT delete associated images from Cloudinary.
    // If you need to delete images on deleteAll, you would need to fetch all
    // documents first, extract image URLs, and then call cloudinary.uploader.destroy
    // for each image before calling deleteMany(). This can be resource-intensive.
    await Model.deleteMany();
    res.status(204).send();
  });

// const asyncHandler = require('express-async-handler');
// const ApiError = require('../utils/apiError');
// const ApiFeatures = require('../utils/apiFeatures');

// const setImageUrl = (doc) => {
//   if (doc.imageCover) {
//     const imageCoverUrl = `${process.env.BASE_URL}/products/${doc.imageCover}`;
//     doc.imageCover = imageCoverUrl;
//   }
//   if (doc.images) {
//     const images = [];
//     doc.images.forEach((image) => {
//       const imageUrl = `${process.env.BASE_URL}/products/${image}`;
//       images.push(imageUrl);
//     });
//     doc.images = images;
//   }
// };

// exports.deleteOne = (Model) =>
//   asyncHandler(async (req, res, next) => {
//     const document = await Model.findByIdAndDelete(req.params.id);

//     if (!document) {
//       next(
//         new ApiError(`No document found for this id: ${req.params.id}`, 404)
//       );
//     }
//     // To trigger 'remove' event when delete document
//     document.remove();
//     // 204 no content
//     res.status(204).send();
//   });

// exports.updateOne = (Model) =>
//   asyncHandler(async (req, res, next) => {
//     const document = await Model.findByIdAndUpdate(req.params.id, req.body, {
//       new: true,
//     });

//     if (!document) {
//       return next(
//         new ApiError(`No document found for this id: ${req.params.id}`, 404)
//       );
//     }

//     // To trigger 'save' event when update document
//     const doc = await document.save();

//     if (doc.constructor.modelName === 'Product') {
//       setImageUrl(doc);
//     }
//     res.status(200).json({ data: doc });
//   });

// exports.createOne = (Model) =>
//   asyncHandler(async (req, res) => {
//     const newDoc = await Model.create(req.body);

//     if (newDoc.constructor.modelName === 'Product') {
//       setImageUrl(newDoc);
//     }
//     res.status(201).json({ data: newDoc });
//   });

// exports.getOne = (Model, populateOpts) =>
//   asyncHandler(async (req, res, next) => {
//     const { id } = req.params;
//     // Build query
//     let query = Model.findById(id);
//     if (populateOpts) query = query.populate(populateOpts);

//     // Execute query
//     const document = await query;

//     if (!document) {
//       return next(new ApiError(`No document for this id ${id}`, 404));
//     }

//     if (document.constructor.modelName === 'Product') {
//       setImageUrl(document);
//     }
//     res.status(200).json({ data: document });
//   });

// exports.getAll = (Model, modelName = '') =>
//   asyncHandler(async (req, res) => {
//     let filter = {};
//     if (req.filterObject) {
//       filter = req.filterObject;
//     }

//     // Build query
//     // const documentsCounts = await Model.countDocuments();
//     const apiFeatures = new ApiFeatures(Model.find(filter), req.query)
//       .filter()
//       .search(modelName)
//       .limitFields()
//       .sort();
//     // .paginate();

//     // Apply pagination after filer and search
//     const docsCount = await Model.countDocuments(apiFeatures.mongooseQuery);
//     apiFeatures.paginate(docsCount);

//     // Execute query
//     const { mongooseQuery, paginationResult } = apiFeatures;
//     const documents = await mongooseQuery;

//     // Set Images url
//     if (Model.collection.collectionName === 'products') {
//       documents.forEach((doc) => setImageUrl(doc));
//     }
//     res
//       .status(200)
//       .json({ results: docsCount, paginationResult, data: documents });
//   });

// exports.deleteAll = (Model) =>
//   asyncHandler(async (req, res, next) => {
//     await Model.deleteMany();
//     // 204 no content
//     res.status(204).send();
//   });
