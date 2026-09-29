const express = require('express');
const pool = require('../db');
const asyncHandler = require('../asyncHandler');

const router = express.Router();

router.get('/', asyncHandler(async (req, res) => {
  const result = await pool.query('SELECT * FROM products ORDER BY id');
  res.json(result.rows);
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const result = await pool.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'product not found' });
  }
  res.json(result.rows[0]);
}));

router.post('/', asyncHandler(async (req, res) => {
  const { name, description, price, stock } = req.body;
  if (!name || price == null) {
    return res.status(400).json({ error: 'name and price are required' });
  }
  const result = await pool.query(
    'INSERT INTO products (name, description, price, stock) VALUES ($1, $2, $3, $4) RETURNING *',
    [name, description || null, price, stock || 0]
  );
  res.status(201).json(result.rows[0]);
}));

// Used by order-service to reserve/decrement stock during checkout.
router.patch('/:id/stock', asyncHandler(async (req, res) => {
  const { delta } = req.body;
  if (typeof delta !== 'number') {
    return res.status(400).json({ error: 'delta must be a number' });
  }

  const result = await pool.query(
    'UPDATE products SET stock = stock + $1 WHERE id = $2 AND stock + $1 >= 0 RETURNING *',
    [delta, req.params.id]
  );
  if (result.rows.length === 0) {
    return res.status(409).json({ error: 'insufficient stock or product not found' });
  }
  res.json(result.rows[0]);
}));

module.exports = router;
