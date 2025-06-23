const express = require('express');
const {
  getCategories,
  createCategory,
  getCategory,
  updateCategory,
  deleteCategory,
  uploadCategoryImage,
  resizeImage,
  deleteAll,
} = require('../controllers/categoryController');

const {
  createCategoryValidator,
  getCategoryValidator,
  updateCategoryValidator,
  deleteCategoryValidator,
} = require('../utils/validators/categoryValidator');

const authController = require('../controllers/authController');
const subCategoryRoute = require('./subCategoryRoute');

const router = express.Router();

// Nested route: /categories/:categoryId/subcategories
router.use('/:categoryId/subcategories', subCategoryRoute);

// Routes for /categories
router
  .route('/')
  .get(getCategories)
  .post(
    authController.auth,
    authController.allowedTo('admin', 'manager'),
    uploadCategoryImage,
    resizeImage,
    createCategoryValidator,
    createCategory
  )
  .delete(
    authController.auth,
    authController.allowedTo('admin'),
    deleteAll
  );

// Routes for /categories/:id
router
  .route('/:id')
  .get(getCategoryValidator, getCategory)
  .put(
    authController.auth,
    authController.allowedTo('admin', 'manager'),
    uploadCategoryImage,
    resizeImage,
    updateCategoryValidator,
    updateCategory
  )
  .delete(
    authController.auth,
    authController.allowedTo('admin'),
    deleteCategoryValidator,
    deleteCategory
  );

module.exports = router;
