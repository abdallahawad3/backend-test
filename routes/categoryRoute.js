const express = require('express');

const router = express.Router();
const categoryController = require('../controllers/categoryController');

// Create category with image
router.post(
  '/',
  categoryController.uploadCategoryImage,
  categoryController.resizeImage,
  categoryController.createCategory
);

// Other routes
router.get('/', categoryController.getCategories);
router.get('/:id', categoryController.getCategory);
router.put(
  '/:id',
  categoryController.uploadCategoryImage,
  categoryController.resizeImage,
  categoryController.updateCategory
);

router.delete('/:id', categoryController.deleteCategory);
router.delete('/', categoryController.deleteAll);

module.exports = router;

// const express = require('express');
// const {
//   getCategories,
//   createCategory,
//   getCategory,
//   updateCategory,
//   deleteCategory,
//   uploadCategoryImage,
//   resizeImage,
//   deleteAll,
// } = require('../controllers/categoryController');
// const {
//   createCategoryValidator,
//   getCategoryValidator,
//   updateCategoryValidator,
//   deleteCategoryValidator,
// } = require('../utils/validators/categoryValidator');
// const authController = require('../controllers/authController');

// const subCategoryRoute = require('./subCategoryRoute');

// const router = express.Router();
// router.use('/:categoryId/subcategories', subCategoryRoute);

// router
//   .route('/')
//   .get(getCategories)
//   .post(
//     authController.auth,
//     authController.allowedTo('admin', 'manager'),
//     uploadCategoryImage,
//     resizeImage,
//     createCategoryValidator,
//     createCategory
//   )
//   .delete(deleteAll);

// router
//   .route('/:id')
//   .get(getCategoryValidator, getCategory)
//   .put(
//     authController.auth,
//     authController.allowedTo('admin', 'manager'),
//     uploadCategoryImage,
//     resizeImage,
//     updateCategoryValidator,
//     updateCategory
//   )
//   .delete(
//     authController.auth,
//     authController.allowedTo('admin'),
//     deleteCategoryValidator,
//     deleteCategory
//   );

// module.exports = router;
