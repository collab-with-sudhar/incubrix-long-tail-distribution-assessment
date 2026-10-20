import fs from 'fs';
import path from 'path';
import { globalRegistry } from '../connectors/registry.js';
import { globalCatalogue } from '../catalogue/store.js';
import { Rendition, Connection } from '../types/contract.js';
import { Logger } from '../utils/logger.js';

export interface CertificationRecord {
  connector_key: string;
  destination_id: string;
  certified: boolean;
  timestamp: string;
  steps: {
    step: string;
    passed: boolean;
    output?: any;
    error?: string;
    duration_ms: number;
  }[];
  live_url?: string;
  platform_post_id?: string;
  deleted_confirmed?: boolean;
}

export class CertificationHarness {
  public async certify(
    connectorKey: string,
    destinationId?: string,
    connection: Connection = {}
  ): Promise<CertificationRecord> {
    const connector = globalRegistry.get(connectorKey);
    const destination =
      (destinationId ? globalCatalogue.get(destinationId) : undefined) ||
      globalCatalogue.list().find((d) => d.connector_key === connectorKey) || {
        id: `dest_${connectorKey}_test`,
        name: `Test Destination for ${connectorKey}`,
        url: '/mock',
        platform_key: connectorKey,
        surface: connector.manifest.surfaces[0]?.key || 'topic',
        connector_key: connectorKey
      };

    const record: CertificationRecord = {
      connector_key: connectorKey,
      destination_id: destination.id!,
      certified: false,
      timestamp: new Date().toISOString(),
      steps: []
    };

    const rendition: Rendition = {
      title: `[Test Post] Automated Certification ${Date.now()}`,
      body: `This is an automated certification test post by IncuBrix Distribution Engine. Will be deleted immediately. Timestamp: ${new Date().toISOString()}`,
      canonical_url: 'https://incubrix.com/test',
      is_ai_generated: false,
      is_promotional: false
    };

    let platformPostId: string | undefined;

    // STEP 1: Validate
    const startVal = Date.now();
    try {
      const valResult = await connector.validate(rendition, destination, connection);
      record.steps.push({
        step: 'validate',
        passed: valResult.ok,
        output: valResult,
        duration_ms: Date.now() - startVal
      });
      if (!valResult.ok) {
        throw new Error(`Validation failed: ${JSON.stringify(valResult.violations)}`);
      }
    } catch (err: any) {
      record.steps.push({
        step: 'validate',
        passed: false,
        error: err.message,
        duration_ms: Date.now() - startVal
      });
      return record;
    }

    // Special case for assisted tier: verify assist pack
    if (connector.manifest.tier === 'assisted') {
      const startAssist = Date.now();
      try {
        const pack = await connector.buildAssistPack(rendition, destination);
        record.steps.push({
          step: 'build_assist_pack',
          passed: Boolean(pack.caption && pack.deep_link),
          output: pack,
          duration_ms: Date.now() - startAssist
        });
        record.certified = true;
        this.saveEvidence(connectorKey, record);
        return record;
      } catch (err: any) {
        record.steps.push({
          step: 'build_assist_pack',
          passed: false,
          error: err.message,
          duration_ms: Date.now() - startAssist
        });
        return record;
      }
    }

    // STEP 2: Publish
    const startPub = Date.now();
    try {
      const pubResult = await connector.publish(
        rendition,
        destination,
        connection,
        `cert_idemp_${Date.now()}`
      );
      platformPostId = pubResult.platform_post_id;
      record.platform_post_id = platformPostId;
      record.live_url = pubResult.live_url;
      record.steps.push({
        step: 'publish',
        passed: Boolean(pubResult.platform_post_id && pubResult.live_url),
        output: pubResult,
        duration_ms: Date.now() - startPub
      });
    } catch (err: any) {
      record.steps.push({
        step: 'publish',
        passed: false,
        error: err.message,
        duration_ms: Date.now() - startPub
      });
      return record;
    }

    // STEP 3: Confirm Status Live
    const startStatus = Date.now();
    try {
      const statusResult = await connector.getStatus(platformPostId!, connection);
      record.steps.push({
        step: 'get_status',
        passed: statusResult.status === 'published' || statusResult.status === 'pending',
        output: statusResult,
        duration_ms: Date.now() - startStatus
      });
    } catch (err: any) {
      record.steps.push({
        step: 'get_status',
        passed: false,
        error: err.message,
        duration_ms: Date.now() - startStatus
      });
    }

    // STEP 4: Optional Fetch Metrics
    if (connector.manifest.capabilities.includes('metrics')) {
      const startMetrics = Date.now();
      try {
        const metrics = await connector.fetchMetrics(platformPostId!, connection);
        record.steps.push({
          step: 'fetch_metrics',
          passed: true,
          output: metrics,
          duration_ms: Date.now() - startMetrics
        });
      } catch (err: any) {
        record.steps.push({
          step: 'fetch_metrics',
          passed: false,
          error: err.message,
          duration_ms: Date.now() - startMetrics
        });
      }
    }

    // STEP 5: Delete / Cleanup Post (Must-Have 5: Must clean up test posts!)
    const startDel = Date.now();
    try {
      const delResult = await connector.delete(platformPostId!, connection);
      record.deleted_confirmed = delResult.deleted;
      record.steps.push({
        step: 'delete',
        passed: delResult.deleted,
        output: delResult,
        duration_ms: Date.now() - startDel
      });
    } catch (err: any) {
      record.steps.push({
        step: 'delete',
        passed: false,
        error: err.message,
        duration_ms: Date.now() - startDel
      });
    }

    // Certification passed if publish, status, and delete all passed
    record.certified = record.steps.every(
      (s) => s.step === 'fetch_metrics' || s.passed
    );

    this.saveEvidence(connectorKey, record);
    return record;
  }

  private saveEvidence(connectorKey: string, record: CertificationRecord): void {
    const dir = path.resolve(process.cwd(), 'data', 'certification');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const filePath = path.join(dir, `${connectorKey}_evidence.json`);
    fs.writeFileSync(filePath, JSON.stringify(record, null, 2));
    Logger.info(`Certification evidence saved for ${connectorKey} at ${filePath}`);
  }

  public async certifyAll(): Promise<Record<string, CertificationRecord>> {
    const connectors = globalRegistry.list();
    const results: Record<string, CertificationRecord> = {};
    for (const key of connectors) {
      results[key] = await this.certify(key);
    }
    return results;
  }
}

export const globalHarness = new CertificationHarness();
