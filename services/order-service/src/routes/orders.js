const express = require('express');
const pool = require('../db');
const { cartClient, productClient, paymentClient } = require('../clients');
const asyncHandler = require('../asyncHandler');

const router = express.Router();

// Restores stock for items already decremented, used when checkout fails partway through.
async function rollbackStock(items, req) {
  await Promise.allSettled(
    items.map((item) =>
      productClient.patch(`/products/${item.productId}/stock`, { delta: item.quantity })
    )
  ).then((results) => {
    results.forEach((result, idx) => {
      if (result.status === 'rejected') {
        req.log.error(
          { err: result.reason, productId: items[idx].productId },
          'failed to roll back stock'
        );
      }
    });
  });
}

router.post('/', asyncHandler(async (req, res) => {
  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  const { data: cartItems } = await cartClient.get(`/carts/${userId}`);
  if (cartItems.length === 0) {
    return res.status(400).json({ error: 'cart is empty' });
  }

  const lineItems = [];
  for (const item of cartItems) {
    const { data: product } = await productClient.get(`/products/${item.product_id}`);
    lineItems.push({
      productId: item.product_id,
      quantity: item.quantity,
      unitPrice: Number(product.price),
    });
  }

  const decremented = [];
  for (const item of lineItems) {
    try {
      await productClient.patch(`/products/${item.productId}/stock`, {
        delta: -item.quantity,
      });
      decremented.push(item);
    } catch (err) {
      await rollbackStock(decremented, req);
      return res.status(409).json({ error: 'insufficient stock', productId: item.productId });
    }
  }

  const total = lineItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  const orderResult = await pool.query(
    'INSERT INTO orders (user_id, status, total) VALUES ($1, $2, $3) RETURNING *',
    [userId, 'pending', total]
  );
  const order = orderResult.rows[0];

  await Promise.all(
    lineItems.map((item) =>
      pool.query(
        'INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES ($1, $2, $3, $4)',
        [order.id, item.productId, item.quantity, item.unitPrice]
      )
    )
  );

  let payment;
  try {
    const response = await paymentClient.post('/payments', {
      orderId: order.id,
      userId,
      amount: total,
    });
    payment = response.data;
  } catch (err) {
    payment = err.response?.data;
  }

  if (!payment || payment.status !== 'succeeded') {
    await rollbackStock(lineItems, req);
    await pool.query('UPDATE orders SET status = $1 WHERE id = $2', ['payment_failed', order.id]);
    return res.status(402).json({ error: 'payment failed', orderId: order.id });
  }

  await pool.query('UPDATE orders SET status = $1, payment_transaction_id = $2 WHERE id = $3', [
    'paid',
    payment.transaction_id,
    order.id,
  ]);
  await cartClient.delete(`/carts/${userId}`);

  res.status(201).json({
    ...order,
    status: 'paid',
    payment_transaction_id: payment.transaction_id,
    items: lineItems,
  });
}));

router.get('/:userId', asyncHandler(async (req, res) => {
  const result = await pool.query('SELECT * FROM orders WHERE user_id = $1 ORDER BY id DESC', [
    req.params.userId,
  ]);
  res.json(result.rows);
}));

router.get('/:userId/:orderId', asyncHandler(async (req, res) => {
  const orderResult = await pool.query('SELECT * FROM orders WHERE id = $1 AND user_id = $2', [
    req.params.orderId,
    req.params.userId,
  ]);
  if (orderResult.rows.length === 0) {
    return res.status(404).json({ error: 'order not found' });
  }

  const itemsResult = await pool.query('SELECT * FROM order_items WHERE order_id = $1', [
    req.params.orderId,
  ]);
  res.json({ ...orderResult.rows[0], items: itemsResult.rows });
}));

module.exports = router;
