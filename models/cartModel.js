const mongoose = require('mongoose');

const cartSchema = new mongoose.Schema(
  {
    // cartItems
    products: [
      {
        product: { type: mongoose.Schema.ObjectId, ref: 'Product' },
        count: { type: Number, default: 1 },
        color: String,
        price: Number,
      },
    ],
    totalCartPrice: Number,
    totalAfterDiscount: Number,
    cartOwner: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
    },
    coupon: String,
  },
  { timestamps: true }
);


module.exports = mongoose.model('Cart', cartSchema);
