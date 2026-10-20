import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { globalRegistry } from '../connectors/registry.js';
import { globalCatalogue } from '../catalogue/store.js';
import { RulesEngine } from '../rules/engine.js';
import { globalJobManager } from '../jobs/manager.js';
import { globalHarness } from '../certification/harness.js';
import { globalTestPostReaper } from '../cleanup/reaper.js';
import { globalStorageService } from '../storage/service.js';
import { AppError } from '../middleware/errorHandler.js';
import { Rendition, Destination, Connection } from '../types/contract.js';

export const apiV1Router = Router();
export const globalRulesEngine = new RulesEngine();
const upload = multer({ limits: { fileSize: 50 * 1024 * 1024 } });

/**
 * Output Manifest Generator (Integration Standard 9)
 */
function createManifest(startTime: number, warnings: string[] = []) {
  const durationMs = Date.now() - startTime;
  return {
    version: '1.0.0',
    service: 'incubrix-distribution-service',
    engine: 'express-ts-runtime',
    models_providers: {
      ai_provider: process.env.AI_PROVIDER || 'mock',
      model: process.env.AI_MODEL || 'gpt-4o-mini',
      version: '1.0.0'
    },
    settings: {
      simulation_mode: process.env.SIMULATION_MODE === 'true',
      frequency_cap_enforced: true,
      max_retry_attempts: 3
    },
    seed: 42,
    timings: {
      duration_ms: durationMs
    },
    cost_estimate_usd: 0.00015,
    cost_estimate: '$0.00015',
    licence: 'Commercial use permitted',
    rights: 'All rights reserved by creator; syndicate licence granted',
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

    // 3. Execution Engine with 2-Second Background Job Auto-Promotion (Integration Standard 3)
    const job = globalJobManager.createJob('content.publish', callback_url);
    globalJobManager.updateJob(job.id, { status: 'running', progress: 20 });

    const publishTask = (async () => {
      globalJobManager.updateJob(job.id, { status: 'running', progress: 60 });
      const pubResult = await connector.publish(
        preparedRendition,
        destination,
        connection || {},
        idempotencyKey
      );
      globalRulesEngine.recordPost(destination.id || destination.url);

      if (pubResult && pubResult.platform_post_id) {
        globalTestPostReaper.track({
          platformPostId: pubResult.platform_post_id,
          connectorKey: destination.connector_key,
          destination,
          connection: { base_url: destination.url, ...(connection || {}) },
          title: preparedRendition.title
        });
      }

      const completed = {
        ...pubResult,
        job_id: job.id,
        manifest: createManifest(startTime, allWarnings)
      };

      globalJobManager.updateJob(job.id, {
        status: 'succeeded',
        progress: 100,
        result: completed
      });

      return completed;
    })();

    // Explicit async requested -> return 202 immediately
    if (isAsync) {
      publishTask.catch((err: any) => {
        globalJobManager.updateJob(job.id, {
          status: 'failed',
          progress: 100,
          error: { code: err.code || 'PLATFORM_UNAVAILABLE', message: err.message }
        });
      });

      res.status(202).json({
        job_id: job.id,
        status: 'queued',
        progress: 0,
        check_url: `/api/v1/jobs/${job.id}`
      });
      return;
    }

    // Synchronous execution: race against 2000ms threshold (Integration Standard 3)
    const timeoutPromise = new Promise<{ isTimeout: true }>((resolve) =>
      setTimeout(() => resolve({ isTimeout: true }), 2000)
    );

    const raceResult = await Promise.race([
      publishTask.then((data) => ({ isTimeout: false, data })),
      timeoutPromise
    ]);

    if (raceResult.isTimeout) {
      // Operation exceeded 2s -> return 202 with job_id for background poll
      publishTask.catch((err: any) => {
        globalJobManager.updateJob(job.id, {
          status: 'failed',
          progress: 100,
          error: { code: err.code || 'PLATFORM_UNAVAILABLE', message: err.message }
        });
      });

      res.status(202).json({
        job_id: job.id,
        status: 'running',
        progress: 60,
        check_url: `/api/v1/jobs/${job.id}`,
        message: 'Publish operation processing asynchronously (exceeded 2s threshold)'
      });
      return;
    }

    // Completed within 2 seconds
    res.status(200).json(raceResult.data);
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

import { globalCatalogueImporter } from '../catalogue/importer.js';
import { globalRulesCaptureService } from '../rules/capture.js';
import { globalContentTailoringService } from '../catalogue/tailoring.js';

/**
 * POST /api/v1/catalogue/import
 * Ingest CSV of destinations with validation, de-duplication, reachability check, and enrichment (Advanced)
 */
apiV1Router.post('/catalogue/import', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { csv_data, verify_reachability } = req.body;
    if (!csv_data || typeof csv_data !== 'string') {
      throw new AppError('DEST_SPEC_VIOLATION', 'Missing or invalid csv_data string', 400);
    }
    const result = await globalCatalogueImporter.importFromCsv(csv_data, Boolean(verify_reachability));
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/rules/capture
 * AI reads community rules page/text and proposes posting rules (Advanced)
 */
apiV1Router.post('/rules/capture', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { community_name, rules_text, rules_url, destination_id } = req.body;
    if (!community_name || !rules_text) {
      throw new AppError('DEST_SPEC_VIOLATION', 'Missing community_name or rules_text', 400);
    }
    const proposal = await globalRulesCaptureService.captureRules(
      community_name,
      rules_text,
      rules_url,
      destination_id
    );
    res.status(200).json(proposal);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/rules/confirm
 * Human confirms or modifies proposed rules before activation (Advanced)
 */
apiV1Router.post('/rules/confirm', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { proposal_id, approved, overrides, reviewer_notes } = req.body;
    if (!proposal_id || approved === undefined) {
      throw new AppError('DEST_SPEC_VIOLATION', 'Missing proposal_id or approved boolean flag', 400);
    }
    const confirmed = globalRulesCaptureService.confirmRules(
      proposal_id,
      Boolean(approved),
      overrides,
      reviewer_notes
    );
    res.status(200).json(confirmed);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/catalogue/score-relevance
 * Score destination 1-5 against IncuBrix target audience (Advanced)
 */
apiV1Router.post('/catalogue/score-relevance', (req: Request, res: Response, next: NextFunction) => {
  try {
    const destination = req.body;
    if (!destination || !destination.name) {
      throw new AppError('DEST_SPEC_VIOLATION', 'Missing destination object', 400);
    }
    const scoreResult = globalContentTailoringService.scoreRelevance(destination);
    res.status(200).json(scoreResult);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/content/tailor
 * Adapts title, body, and framing per destination type (Advanced)
 */
apiV1Router.post('/content/tailor', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rendition, destination_id, destination: customDestination } = req.body;
    if (!rendition) {
      throw new AppError('DEST_SPEC_VIOLATION', 'Missing rendition object', 400);
    }
    const destination = (destination_id ? globalCatalogue.get(destination_id) : undefined) || customDestination;
    if (!destination) {
      throw new AppError('DEST_SPEC_VIOLATION', `Destination not found for id: ${destination_id}`, 404);
    }
    const tailored = globalContentTailoringService.tailor(rendition, destination);
    res.status(200).json(tailored);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/certification/evidence
 * Return all recorded certification evidence files
 */
apiV1Router.get('/certification/evidence', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const fs = await import('fs');
    const path = await import('path');
    const certDir = path.resolve(process.cwd(), 'data', 'certification');
    if (!fs.existsSync(certDir)) {
      res.status(200).json({ evidence: [] });
      return;
    }
    const files = fs.readdirSync(certDir).filter((f: string) => f.endsWith('.json'));
    const evidence = files.map((file: string) => {
      const content = fs.readFileSync(path.join(certDir, file), 'utf8');
      try {
        return { filename: file, data: JSON.parse(content) };
      } catch {
        return { filename: file, raw: content };
      }
    });
    res.status(200).json({ total: evidence.length, evidence });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/cleanup/posts
 * Must-Have 5: Active test posts tracking & countdown
 */
apiV1Router.get('/cleanup/posts', (req: Request, res: Response) => {
  const posts = globalTestPostReaper.list();
  res.status(200).json({
    active_test_posts: posts.filter(p => !p.deleted),
    history: posts.filter(p => p.deleted),
    total_tracked: posts.length,
    ttl_rule: 'Must-Have 5: All test posts auto-deleted within 10 minutes'
  });
});

/**
 * POST /api/v1/cleanup/purge
 * Must-Have 5: Immediately purge/delete all tracked test posts
 */
apiV1Router.post('/cleanup/purge', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await globalTestPostReaper.purgeAll();
    res.status(200).json({
      status: 'purged',
      ...result
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/files/upload
 * Accept multipart file upload or remote URL (Integration Standard 7: Files in, files out)
 */
apiV1Router.post('/files/upload', upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.file) {
      const stored = await globalStorageService.saveBuffer(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype
      );
      return res.status(201).json(stored);
    }

    if (req.body && req.body.url) {
      const stored = await globalStorageService.saveFromUrl(req.body.url);
      return res.status(201).json(stored);
    }

    throw new AppError('DEST_SPEC_VIOLATION', 'Either multipart "file" or JSON "url" must be provided', 400);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/files
 * List all stored files and assets (Integration Standard 7)
 */
apiV1Router.get('/files', (req: Request, res: Response) => {
  const files = globalStorageService.listFiles();
  res.status(200).json({
    total: files.length,
    files
  });
});

/**
 * GET /api/v1/files/:filename
 * Download / serve stored file (Integration Standard 7: Files in, files out)
 */
apiV1Router.get('/files/:filename', (req: Request, res: Response, next: NextFunction) => {
  try {
    const filename = req.params.filename;
    const filePath = globalStorageService.getFilePath(filename);
    if (!filePath) {
      throw new AppError('DEST_SPEC_VIOLATION', `File not found: ${filename}`, 404);
    }
    res.sendFile(filePath);
  } catch (err) {
    next(err);
  }
});




