import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import { correlationMiddleware } from './middleware/correlation.js';
import { idempotencyMiddleware } from './middleware/idempotency.js';
import { errorHandler } from './middleware/errorHandler.js';
import { connectorRouter } from './routes/connector.v1.js';
import { apiV1Router } from './routes/api.v1.js';
import { mockRouter } from './routes/mock.js';
import { globalTestPostReaper } from './cleanup/reaper.js';
import { Logger } from './utils/logger.js';

import path from 'path';

const app = express();
const PORT = process.env.PORT || 3000;

// Security and utility middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(correlationMiddleware);
app.use(idempotencyMiddleware());

// Serve static frontend files
app.use(express.static(path.resolve(process.cwd(), 'public')));

// Health & Readiness Endpoints (Integration Standard 8)
const healthHandler = (req: express.Request, res: express.Response) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime_seconds: process.uptime()
  });
};
app.get('/health', healthHandler);
app.get('/api/v1/health', healthHandler);

app.get('/ready', (req: express.Request, res: express.Response) => {
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

// Local Mock Servers (Discourse, Ghost, Lemmy, Webhook, Hashnode, Slack)
app.use('/mock', mockRouter);

// Global Error Handler
app.use(errorHandler);

if (process.env.NODE_ENV !== 'test') {
  globalTestPostReaper.start();
  app.listen(PORT, () => {
    Logger.info(`IncuBrix Long-Tail Distribution Connector Service listening on port ${PORT}`, {
      port: PORT,
      simulation_mode: process.env.SIMULATION_MODE === 'true'
    });
  });
}

export default app;
