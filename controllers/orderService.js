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
  // app settings
  const taxPrice = 0;
  const shippingPrice = 0;

  // 1) Get logged user cart
  const cart = await Cart.findById(req.params.cartId);
  if (!cart) {
    return next(
      new ApiError(`There is no cart for this user :${req.user._id}`, 404)
    );
  }

  // 2) Check if there is coupon apply
  const cartPrice = cart.totalAfterDiscount
    ? cart.totalAfterDiscount
    : cart.totalCartPrice;

  // 3) Create order with default cash option
  const order = await Order.create({
    user: req.user._id,
    cartItems: cart.products,
    shippingAddress: req.body.shippingAddress,
    totalOrderPrice: taxPrice + shippingPrice + cartPrice,
  });

  // 4) After creating order decrement product quantity, increment sold
  // Performs multiple write operations with controls for order of execution.
  if (order) {
    const bulkOption = cart.products.map((item) => ({
      updateOne: {
        filter: { _id: item.product },
        update: { $inc: { quantity: -item.count, sold: +item.count } },
      },
    }));

    await Product.bulkWrite(bulkOption, {});

    // 5) Clear cart
    await Cart.findByIdAndDelete(req.params.cartId);
  }

  // Success response for cash order creation
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
  const cart = await Cart.findById(req.params.cartId);
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
          unit_amount: cartPrice * 100, // Amount in cents
          product_data: {
            name: req.user.name || 'User Order', // Provide a meaningful name for the product
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
    metadata: req.body.shippingAddress,
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
  console.log('Stripe Session received:', JSON.stringify(session, null, 2));

  // 1) Get needed data from session
  const cartId = session.client_reference_id;
  // Use session.amount_total directly as it's the total amount
  const checkoutAmount = session.amount_total / 100;
  // Make sure metadata is an object, not just a string, if you're sending multiple fields
  const shippingAddress = session.metadata;

  console.log(`Extracted: cartId=${cartId}, checkoutAmount=${checkoutAmount}, shippingAddress=${JSON.stringify(shippingAddress)}`);

  // 2) Get Cart and User
  const cart = await Cart.findById(cartId);
  const user = await User.findOne({ email: session.customer_email });

  if (!cart) {
    console.error('Error in createOrderCheckout: Cart not found for cartId:', cartId);
    return; // Stop execution if cart is not found
  }
  if (!user) {
    console.error('Error in createOrderCheckout: User not found for email:', session.customer_email);
    return; // Stop execution if user is not found
  }

  console.log('Cart and User found. Proceeding with order creation.');

  //3) Create order
  try {
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

    // 4) After creating order decrement product quantity, increment sold
    if (order) {
      const bulkOption = cart.products.map((item) => ({
        updateOne: {
          filter: { _id: item.product },
          update: { $inc: { quantity: -item.count, sold: +item.count } },
        },
      }));

      await Product.bulkWrite(bulkOption, {});
      console.log('Product quantities updated successfully.');

      // 5) Clear cart
      await Cart.findByIdAndDelete(cart._id);
      console.log(`Cart cleared successfully for cartId: ${cart._id}.`);
    } else {
      console.error('Order object is null after creation attempt, skipping product updates and cart clear.');
    }
  } catch (err) {
    console.error('Error creating order in createOrderCheckout:', err);
    // Potentially rethrow or log to a more persistent error tracking system
  }
  console.log('--- createOrderCheckout finished ---');
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
    // Respond with 400 immediately if signature is invalid
    return res.status(400).send(`Webhook error: ${err.message}`);
  }

  // Handle the event
  if (event.type === 'checkout.session.completed') {
    console.log(`Stripe webhook received: ${event.type} event.`);
    // Await the asynchronous function call here using .then/.catch
    createOrderCheckout(event.data.object)
      .then(() => console.log('Stripe webhook processed: Order creation and cart clearing initiated successfully.'))
      .catch((error) => console.error('Error processing webhook checkout (async handler):', error));
  } else {
    console.log(`Unhandled event type ${event.type}`);
  }

  // Always respond with 200 to Stripe immediately to acknowledge receipt of the event
  // Stripe expects a 200 OK within a certain timeframe (usually 15 seconds)
  res.status(200).json({ received: true });
};