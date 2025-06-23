const express = require('express');
const {
  getProduct,
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  resizeProductImages,
} = require('../controllers/productController');

const {
  createProductValidator,
  getProductValidator,
  updateProductValidator,
  deleteProductValidator,
} = require('../utils/validators/productValidator');

const authController = require('../controllers/authController');
const reviewRoute = require('./reviewRoute');
const { uploadMixedImages } = require('../middlewares/imageUpload');

const router = express.Router();

// Nested routes for product reviews
router.use('/:productId/reviews', reviewRoute);

// Route: /api/v1/products/
router
  .route('/')
  .get(getProducts)
  .post(
    authController.auth,
    authController.allowedTo('admin', 'manager'),
    uploadMixedImages([
      { name: 'imageCover', maxCount: 1 },
      { name: 'images', maxCount: 5 }
    ]),
    resizeProductImages,
    createProductValidator,
    createProduct
  );

// Route: /api/v1/products/:id
router
  .route('/:id')
  .get(getProductValidator, getProduct)
  .put(
    authController.auth,
    authController.allowedTo('admin', 'manager'),
    uploadMixedImages([
      { name: 'imageCover', maxCount: 1 },
      { name: 'images', maxCount: 5 }
    ]),
    resizeProductImages,
    updateProductValidator,
    updateProduct
  )
  .delete(
    authController.auth,
    authController.allowedTo('admin'),
    deleteProductValidator,
    deleteProduct
  );

module.exports = router;
