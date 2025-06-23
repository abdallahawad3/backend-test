const express = require('express');
const {
  getBrands,
  createBrand,
  getBrand,
  updateBrand,
  deleteBrand,
  resizeImage,
  deleteAll,
} = require('../controllers/brandController');

const {
  createBrandValidator,
  getBrandValidator,
  updateBrandValidator,
  deleteBrandValidator,
} = require('../utils/validators/brandValidator');

const authController = require('../controllers/authController');
const { uploadSingleImage } = require('../middlewares/imageUpload');

const router = express.Router();

router
  .route('/')
  .get(getBrands)
  .post(
    authController.auth,
    authController.allowedTo('admin', 'manager'),
    uploadSingleImage('image'),
    resizeImage,
    createBrandValidator,
    createBrand
  )
  .delete(deleteAll);

router
  .route('/:id')
  .get(getBrandValidator, getBrand)
  .put(
    authController.auth,
    authController.allowedTo('admin', 'manager'),
    uploadSingleImage('image'),
    resizeImage,
    updateBrandValidator,
    updateBrand
  )
  .delete(
    authController.auth,
    authController.allowedTo('admin'),
    deleteBrandValidator,
    deleteBrand
  );

module.exports = router;
