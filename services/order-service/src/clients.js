const axios = require('axios');

const timeout = 5000;

const cartClient = axios.create({ baseURL: process.env.CART_SERVICE_URL, timeout });
const productClient = axios.create({ baseURL: process.env.PRODUCT_SERVICE_URL, timeout });
const paymentClient = axios.create({ baseURL: process.env.PAYMENT_SERVICE_URL, timeout });

module.exports = { cartClient, productClient, paymentClient };
