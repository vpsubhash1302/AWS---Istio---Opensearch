const express = require('express');
const crypto = require('crypto');
const pool = require('../db');
const asyncHandler = require('../asyncHandler');

const router = express.Router();

// Mock payment processing: succeeds 90% of the time.
router.post('/', asyncHandler(async (req, res) => {
  const { orderId, userId, amount } = req.body;
  if (!orderId || !userId || amount == null) {
    return res.status(400).json({ error: 'orderId, userId and amount are required' });
  }

  const succeeded = Math.random() < 0.9;
  const status = succeeded ? 'succeeded' : 'failed';
  const transactionId = crypto.randomUUID();

  const result = await pool.query(
    'INSERT INTO payments (order_id, user_id, amount, status, transaction_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [orderId, userId, amount, status, transactionId]
  );

  const payment = result.rows[0];
  res.status(succeeded ? 201 : 402).json(payment);
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const result = await pool.query('SELECT * FROM payments WHERE id = $1', [req.params.id]);
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'payment not found' });
  }
  res.json(result.rows[0]);
}));

module.exports = router;
