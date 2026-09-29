require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pinoHttp = require('pino-http');
const logger = require('./logger');
const pool = require('./db');
const productsRouter = require('./routes/products');

const app = express();
app.use(cors());
app.use(express.json());
app.use(pinoHttp({ logger }));

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.get('/ready', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ready' });
  } catch (err) {
    req.log.error({ err }, 'readiness check failed');
    res.status(503).json({ status: 'not ready' });
  }
});

app.use('/products', productsRouter);

app.use((err, req, res, next) => {
  req.log.error({ err }, 'unhandled error');
  res.status(500).json({ error: 'internal error' });
});

const port = process.env.PORT || 3002;
app.listen(port, () => {
  logger.info({ port }, 'product-service listening');
});
