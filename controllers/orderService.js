const asyncHandler = require('express-async-handler');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const ApiError = require('../utils/apiError');
const factory = require('./handlersFactory');
const User = require('../models/userModel');
const Product = require('../models/productModel');
const Cart = require('../models/cartModel');
const Order = require('../models/orderModel');

// @desc    Create new order
// @route   POST /api/orders/cartId
// @access  Private/Protected/User
exports.createCashOrder = asyncHandler(async (req, res, next) => {
  const taxPrice = 0;
  const shippingPrice = 0;

  console.log('Creating cash order for cartId:', req.params.cartId);
  const cart = await Cart.findById(req.params.cartId);
  if (!cart) {
    console.error('Cart not found for cartId:', req.params.cartId);
    return next(new ApiError(`There is no cart for this user: ${req.user._id}`, 404));
  }

  const cartPrice = cart.totalAfterDiscount ? cart.totalAfterDiscount : cart.totalCartPrice;
  console.log('Cart price:', cartPrice, 'Shipping address:', req.body.shippingAddress);

  const order = await Order.create({
    user: req.user._id,
    cartItems: cart.products,
    shippingAddress: req.body.shippingAddress,
    totalOrderPrice: taxPrice + shippingPrice + cartPrice,
  });
  console.log('Order created:', order._id);

  if (order) {
    const bulkOption = cart.products.map((item) => ({
      updateOne: {
        filter: { _id: item.product },
        update: { $inc: { quantity: -item.count, sold: +item.count } },
      },
    }));
    await Product.bulkWrite(bulkOption, {});
    console.log('Product quantities updated');

    await Cart.findByIdAndDelete(req.params.cartId);
    console.log('Cart deleted:', req.params.cartId);
  }

  res.status(201).json({ status: 'success', message: 'Cash order created successfully', data: order });
});

// @desc    Get Specific order
// @route   GET /api/orders/:id
// @access  Private/Protected/User-Admin
exports.getSpecificOrder = factory.getOne(Order);

exports.filterOrdersForLoggedUser = asyncHandler(async (req, res, next) => {
  if (req.user.role === 'user') req.filterObject = { user: req.user._id };
  next();
});

// @desc    Get my orders
// @route   GET /api/orders
// @access  Private/Protected/User-Admin
exports.getAllOrders = factory.getAll(Order);

// @desc    Update  order to  paid
// @route   PUT /api/orders/:id/pay
// @access  Private/Protected/User-Admin
exports.updateOrderToPaid = asyncHandler(async (req, res, next) => {
  const order = await Order.findById(req.params.id);

  if (!order) {
    return next(
      new ApiError(`There is no order for this id: ${req.params.id}`, 404)
    );
  }

  order.isPaid = true;
  order.paidAt = Date.now();

  const updatedOrder = await order.save();
  // Success response
  res.status(200).json({
    status: 'Success',
    message: 'Order status updated to paid successfully',
    data: updatedOrder,
  });
});

// @desc    Update order to delivered
// @route   PUT /api/orders/:id/deliver
// @access  Private/Admin
exports.updateOrderToDelivered = asyncHandler(async (req, res, next) => {
  const order = await Order.findById(req.params.id);

  if (!order) {
    return next(
      new ApiError(`There is no order for this id: ${req.params.id}`, 404)
    );
  }

  order.isDelivered = true;
  order.deliveredAt = Date.now();

  const updatedOrder = await order.save();
  // Success response
  res.status(200).json({ status: 'Success', message: 'Order status updated to delivered successfully', data: updatedOrder });
});

// @desc    Create order checkout session
// @route   GET /api/orders/:cartId
// @access  Private/User
exports.checkoutSession = asyncHandler(async (req, res, next) => {
  // 1) Get the currently cart
  const cart = await Cart.findById({ _id: "685c20d8fb69c7b88ddcc2b6" });
  if (!cart) {
    return next(
      new ApiError(`There is no cart for this user :${req.user._id}`, 404)
    );
  }

  // 2) Get cart price, Check if there is coupon apply
  const cartPrice = cart.totalAfterDiscount
    ? cart.totalAfterDiscount
    : cart.totalCartPrice;

  // 3) Create checkout session
  const session = await stripe.checkout.sessions.create({
    line_items: [
      {
        price_data: {
          currency: 'egp',
          unit_amount: cartPrice * 100,
          product_data: {
            name: req.user.name || 'User Order',
            description: `Order from ${req.user.email} for ${cart.products.length} items`,
          },
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url: `https://graduation-project-v01.netlify.app/user/orders`,
    cancel_url: `https://graduation-project-v01.netlify.app/cart`,
    customer_email: req.user.email,
    client_reference_id: req.params.cartId,
    metadata: {
      address: req.body.shippingAddress.address || '',
      city: req.body.shippingAddress.city || '',
    },
  });
  // 3) Create session as response
  // Success response for checkout session creation
  res.status(200).json({
    status: 'success',
    message: 'Checkout session created successfully',
    session,
  });
});

const createOrderCheckout = async (session) => {
  console.log('--- createOrderCheckout started ---');
  const cartId = session.client_reference_id;
  const checkoutAmount = session.amount_total / 100;
  const shippingAddress = session.metadata;

  const cart = await Cart.findById(cartId);
  if (!cart) {
    throw new Error(`Cart not found for cartId: ${cartId}`);
  }

  const user = await User.findOne({ email: session.customer_email });
  if (!user) {
    throw new Error(`User not found for email: ${session.customer_email}`);
  }

  const order = await Order.create({
    user: user._id,
    cartItems: cart.products,
    shippingAddress,
    totalOrderPrice: checkoutAmount,
    paymentMethodType: 'card',
    isPaid: true,
    paidAt: Date.now(),
  });

  console.log('Order created successfully:', order._id);

  const bulkOption = cart.products.map((item) => ({
    updateOne: {
      filter: { _id: item.product },
      update: { $inc: { quantity: -item.count, sold: +item.count } },
    },
  }));

  await Product.bulkWrite(bulkOption, {});
  console.log('Product quantities updated successfully.');

  await Cart.findByIdAndDelete(cart._id);
  console.log(`Cart cleared successfully for cartId: ${cart._id}.`);
};

// @desc    This webhook will run when stipe payment successfully paid
// @route   PUT /webhook-checkout
// @access  From stripe
exports.webhookCheckout = (req, res, next) => {
  const signature = req.headers['stripe-signature'].toString();
  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    return res.status(400).send(`Webhook error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    createOrderCheckout(event.data.object)
      .then(() => {
        console.log('Order creation and cart clearing completed');
        res.status(200).json({ received: true });
      })
      .catch((error) => {
        console.error('Error in createOrderCheckout:', error);
        res.status(500).send(`Webhook processing error: ${error.message}`);
      });
  } else {
    console.log(`Unhandled event type ${event.type}`);
    res.status(200).json({ received: true });
  }
};