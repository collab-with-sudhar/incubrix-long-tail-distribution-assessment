import { Router, Request, Response, NextFunction } from 'express';
import { globalRegistry } from '../connectors/registry.js';
import { AppError } from '../middleware/errorHandler.js';

export const connectorRouter = Router();

connectorRouter.post('/:connector_key/:method', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { connector_key, method } = req.params;
    const body = req.body || {};

    const connector = globalRegistry.get(connector_key);

    switch (method) {
      case 'validate': {
        const { rendition, destination, connection } = body;
        if (!rendition || !destination) {
          throw new AppError('DEST_SPEC_VIOLATION', 'Missing rendition or destination payload', 400);
        }
        const result = await connector.validate(rendition, destination, connection || {});
        res.status(200).json(result);
        return;
      }

      case 'publish': {
        const { rendition, destination, connection } = body;
        const idempotencyKey =
          body.idempotency_key ||
          (req.headers['idempotency-key'] as string) ||
          `idemp_${Date.now()}`;

        if (!rendition || !destination) {
          throw new AppError('DEST_SPEC_VIOLATION', 'Missing rendition or destination payload', 400);
        }

        const result = await connector.publish(rendition, destination, connection || {}, idempotencyKey);
        res.status(200).json(result);
        return;
      }

      case 'get_status': {
        const { platform_post_id, connection } = body;
        if (!platform_post_id) {
          throw new AppError('DEST_SPEC_VIOLATION', 'Missing platform_post_id', 400);
        }
        const result = await connector.getStatus(platform_post_id, connection || {});
        res.status(200).json(result);
        return;
      }

      case 'delete': {
        const { platform_post_id, connection } = body;
        if (!platform_post_id) {
          throw new AppError('DEST_SPEC_VIOLATION', 'Missing platform_post_id', 400);
        }
        const result = await connector.delete(platform_post_id, connection || {});
        res.status(200).json(result);
        return;
      }

      case 'fetch_metrics': {
        const { platform_post_id, connection, since } = body;
        if (!platform_post_id) {
          throw new AppError('DEST_SPEC_VIOLATION', 'Missing platform_post_id', 400);
        }
        const result = await connector.fetchMetrics(platform_post_id, connection || {}, since);
        res.status(200).json(result);
        return;
      }

      case 'refresh_auth': {
        const { connection } = body;
        const result = await connector.refreshAuth(connection || {});
        res.status(200).json(result);
        return;
      }

      case 'build_assist_pack': {
        const { rendition, destination } = body;
        if (!rendition || !destination) {
          throw new AppError('DEST_SPEC_VIOLATION', 'Missing rendition or destination payload', 400);
        }
        const result = await connector.buildAssistPack(rendition, destination);
        res.status(200).json(result);
        return;
      }

      default:
        throw new AppError('DEST_SPEC_VIOLATION', `Unsupported connector method: ${method}`, 404);
    }
  } catch (err) {
    next(err);
  }
});
