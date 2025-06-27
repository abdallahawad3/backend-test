const path = require('path');
const express = require('express');
const dotenv = require('dotenv');

dotenv.config({ path: 'config.env' });
const morgan = require('morgan');
require('colors');
const compression = require('compression');
const cors = require('cors');
const bodyParser = require('body-parser');

const ApiError = require('./utils/apiError');
const globalError = require('./middlewares/errorMiddleware');
const mountRoutes = require('./routes');
const { webhookCheckout } = require('./controllers/orderService');

const dbConnection = require('./config/database');



dbConnection();

const app = express();

app.use(cors());
app.options('*', cors());
app.enable('trust proxy');

app.post(
  '/webhook-checkout',
  bodyParser.raw({ type: 'application/json' }),
  webhookCheckout
);


app.use(express.json());

app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(express.static(path.join(__dirname, 'uploads')));

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
  console.log(`Mode : ${process.env.NODE_ENV}`.yellow);
}

app.use(compression());

app.use(cors());


mountRoutes(app);

app.all('*', (req, res, next) => {
  next(new ApiError(`Can't find this route: ${req.originalUrl}`, 400));
});

app.use(globalError);

const PORT = process.env.PORT || 8000;
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`.green);
});


process.on('unhandledRejection', (err) => {
  console.log(err.name, err.message);
  server.close(() => {
    console.log('unhandledRejection!! shutting down...');
    process.exit(1);
  });
});
