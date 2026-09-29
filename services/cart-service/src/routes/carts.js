const express = require('express');
const pool = require('../db');
const asyncHandler = require('../asyncHandler');

const router = express.Router();

router.get('/:userId', asyncHandler(async (req, res) => {
  const result = await pool.query('SELECT * FROM cart_items WHERE user_id = $1', [
    req.params.userId,
  ]);
  res.json(result.rows);
}));

router.post('/:userId/items', asyncHandler(async (req, res) => {
  const { productId, quantity } = req.body;
  if (!productId || !quantity) {
    return res.status(400).json({ error: 'productId and quantity are required' });
  }

  const result = await pool.query(
    `INSERT INTO cart_items (user_id, product_id, quantity)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, product_id)
     DO UPDATE SET quantity = cart_items.quantity + EXCLUDED.quantity
     RETURNING *`,
    [req.params.userId, productId, quantity]
  );
  res.status(201).json(result.rows[0]);
}));

router.delete('/:userId/items/:productId', asyncHandler(async (req, res) => {
  await pool.query('DELETE FROM cart_items WHERE user_id = $1 AND product_id = $2', [
    req.params.userId,
    req.params.productId,
  ]);
  res.status(204).send();
}));

// Used by order-service after a successful checkout.
router.delete('/:userId', asyncHandler(async (req, res) => {
  await pool.query('DELETE FROM cart_items WHERE user_id = $1', [req.params.userId]);
  res.status(204).send();
}));

module.exports = router;
