import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import { correlationMiddleware } from './middleware/correlation.js';
import { idempotencyMiddleware } from './middleware/idempotency.js';
import { errorHandler } from './middleware/errorHandler.js';
import { connectorRouter } from './routes/connector.v1.js';
import { apiV1Router } from './routes/api.v1.js';
import { Logger } from './utils/logger.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Security and utility middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(correlationMiddleware);
app.use(idempotencyMiddleware());

// Health & Readiness Endpoints (Integration Standard 8)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime_seconds: process.uptime()
  });
});

app.get('/ready', (req, res) => {
  res.status(200).json({
    status: 'ready',
    simulation_mode: process.env.SIMULATION_MODE === 'true',
    version: '1.0.0'
  });
});

// Appendix A Connector Contract routes
app.use('/connector/v1', connectorRouter);

// Integration Standard API routes
app.use('/api/v1', apiV1Router);

// Global Error Handler
app.use(errorHandler);

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    Logger.info(`IncuBrix Long-Tail Distribution Connector Service listening on port ${PORT}`, {
      port: PORT,
      simulation_mode: process.env.SIMULATION_MODE === 'true'
    });
  });
}

export default app;
