import { Router, Request, Response, NextFunction } from 'express';
import { globalRegistry } from '../connectors/registry.js';
import { globalCatalogue } from '../catalogue/store.js';
import { RulesEngine } from '../rules/engine.js';
import { globalJobManager } from '../jobs/manager.js';
import { globalHarness } from '../certification/harness.js';
import { AppError } from '../middleware/errorHandler.js';
import { Rendition, Destination, Connection } from '../types/contract.js';

export const apiV1Router = Router();
export const globalRulesEngine = new RulesEngine();

/**
 * Output Manifest Generator (Integration Standard 9)
 */
function createManifest(startTime: number, warnings: string[] = []) {
  return {
    version: '1.0.0',
    service: 'incubrix-distribution-service',
    engine: 'express-ts-runtime',
    timings: {
      duration_ms: Date.now() - startTime
    },
    cost_estimate_usd: 0.00015,
    licence: 'Commercial use permitted',
    warnings
  };
}

/**
 * POST /api/v1/publish
 * Unified publishing endpoint with rules engine, validation, and manifests
 */
apiV1Router.post('/publish', async (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  try {
    const {
      rendition,
      destination_id,
      destination: customDestination,
      connection,
      async: isAsync,
      callback_url
    } = req.body;

    const idempotencyKey =
      (req.headers['idempotency-key'] as string) ||
      req.body.idempotency_key ||
      `pub_${Date.now()}`;

    if (!rendition) {
      throw new AppError('DEST_SPEC_VIOLATION', 'Missing rendition object', 400);
    }

    const destination: Destination | undefined =
      (destination_id ? globalCatalogue.get(destination_id) : undefined) || customDestination;

    if (!destination) {
      throw new AppError('DEST_SPEC_VIOLATION', `Destination not found for id: ${destination_id}`, 404);
    }

    // 1. Rules Check (Frequency cap, Self promo, Link policy, AI disclosure)
    const ruleEvaluation = globalRulesEngine.evaluate(rendition, destination);
    if (!ruleEvaluation.allowed) {
      if (ruleEvaluation.action === 'reschedule') {
        throw new AppError(
          'DEST_RULE_FREQUENCY_CAP',
          ruleEvaluation.violations[0]?.message || 'Posting frequency limit reached',
          429,
          true,
          { retry_after_seconds: ruleEvaluation.reschedule_after_seconds }
        );
      }
      throw new AppError(
        'PLATFORM_CONTENT_REJECTED',
        ruleEvaluation.violations[0]?.message || 'Content rejected by community posting rules',
        422,
        false,
        { violations: ruleEvaluation.violations }
      );
    }

    const preparedRendition = ruleEvaluation.transformedRendition || rendition;
    const allWarnings = ruleEvaluation.warnings || [];

    // 2. Connector Validation
    const connector = globalRegistry.get(destination.connector_key);
    const valResult = await connector.validate(preparedRendition, destination, connection || {});
    if (!valResult.ok) {
      throw new AppError(
        'DEST_SPEC_VIOLATION',
        'Rendition violates destination surface specification',
        400,
        false,
        { violations: valResult.violations }
      );
    }

    // 3. Asynchronous Execution as Background Job (Integration Standard 3)
    if (isAsync) {
      const job = globalJobManager.createJob('content.publish', callback_url);

      // Execute in background
      setImmediate(async () => {
        try {
          globalJobManager.updateJob(job.id, { status: 'running', progress: 30 });
          const pubResult = await connector.publish(
            preparedRendition,
            destination,
            connection || {},
            idempotencyKey
          );
          globalRulesEngine.recordPost(destination.id || destination.url);

          globalJobManager.updateJob(job.id, {
            status: 'succeeded',
            progress: 100,
            result: {
              ...pubResult,
              manifest: createManifest(startTime, allWarnings)
            }
          });
        } catch (err: any) {
          globalJobManager.updateJob(job.id, {
            status: 'failed',
            progress: 100,
            error: {
              code: err.code || 'PLATFORM_UNAVAILABLE',
              message: err.message
            }
          });
        }
      });

      res.status(202).json({
        job_id: job.id,
        status: job.status,
        check_url: `/api/v1/jobs/${job.id}`
      });
      return;
    }

    // 4. Synchronous Execution
    const pubResult = await connector.publish(
      preparedRendition,
      destination,
      connection || {},
      idempotencyKey
    );
    globalRulesEngine.recordPost(destination.id || destination.url);

    res.status(200).json({
      ...pubResult,
      manifest: createManifest(startTime, allWarnings)
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/jobs/:job_id
 * Background Job Status Poll (Integration Standard 3)
 */
apiV1Router.get('/jobs/:job_id', (req: Request, res: Response, next: NextFunction) => {
  const { job_id } = req.params;
  const job = globalJobManager.getJob(job_id);
  if (!job) {
    throw new AppError('DEST_SPEC_VIOLATION', `Job not found: ${job_id}`, 404);
  }
  res.status(200).json(job);
});

/**
 * GET /api/v1/destinations
 * List Catalogue Destinations (Must-Have 3)
 */
apiV1Router.get('/destinations', (req: Request, res: Response) => {
  const list = globalCatalogue.list();
  res.status(200).json({ total: list.length, destinations: list });
});

/**
 * POST /api/v1/destinations
 * Add New Destination via Configuration (Must-Have 3: Adding destination is 1 row/config without code)
 */
apiV1Router.post('/destinations', (req: Request, res: Response) => {
  const destData = req.body;
  if (!destData.name || !destData.platform_key || !destData.connector_key) {
    throw new AppError('DEST_SPEC_VIOLATION', 'Missing required destination fields (name, platform_key, connector_key)', 400);
  }
  const created = globalCatalogue.add(destData);
  res.status(201).json({ destination: created });
});

/**
 * POST /api/v1/certification/run
 * Run Certification for one or all connectors
 */
apiV1Router.post('/certification/run', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { connector_key } = req.body;
    if (connector_key) {
      const result = await globalHarness.certify(connector_key);
      res.status(200).json(result);
    } else {
      const allResults = await globalHarness.certifyAll();
      res.status(200).json(allResults);
    }
  } catch (err) {
    next(err);
  }
});
