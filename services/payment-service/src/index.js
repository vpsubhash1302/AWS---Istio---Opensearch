require('dotenv').config();
const express = require('express');
const pinoHttp = require('pino-http');
const logger = require('./logger');
const pool = require('./db');
const paymentsRouter = require('./routes/payments');

const app = express();
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

app.use('/payments', paymentsRouter);

app.use((err, req, res, next) => {
  req.log.error({ err }, 'unhandled error');
  res.status(500).json({ error: 'internal error' });
});

const port = process.env.PORT || 3005;
app.listen(port, () => {
  logger.info({ port }, 'payment-service listening');
});
