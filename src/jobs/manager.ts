import crypto from 'crypto';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../utils/logger.js';

export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed';

export interface Job {
  id: string;
  type: string;
  status: JobStatus;
  progress: number; // 0 - 100
  result?: any;
  error?: any;
  callback_url?: string;
  created_at: string;
  updated_at: string;
}

export class JobManager {
  private jobs: Map<string, Job> = new Map();

  public createJob(type: string, callbackUrl?: string): Job {
    const id = uuidv4();
    const now = new Date().toISOString();
    const job: Job = {
      id,
      type,
      status: 'queued',
      progress: 0,
      callback_url: callbackUrl,
      created_at: now,
      updated_at: now
    };
    this.jobs.set(id, job);
    Logger.info(`Job created: ${id}`, { job_id: id, type });
    return job;
  }

  public getJob(id: string): Job | undefined {
    return this.jobs.get(id);
  }

  public updateJob(
    id: string,
    updates: Partial<Pick<Job, 'status' | 'progress' | 'result' | 'error'>>
  ): Job | undefined {
    const job = this.jobs.get(id);
    if (!job) return undefined;

    Object.assign(job, updates, { updated_at: new Date().toISOString() });
    this.jobs.set(id, job);

    Logger.info(`Job updated: ${id} [${job.status} - ${job.progress}%]`, {
      job_id: id,
      status: job.status,
      progress: job.progress
    });

    if ((job.status === 'succeeded' || job.status === 'failed') && job.callback_url) {
      this.triggerWebhookCallback(job).catch((err) => {
        Logger.error(`Failed to trigger callback for job ${id}: ${err.message}`, { job_id: id });
      });
    }

    return job;
  }

  private async triggerWebhookCallback(job: Job): Promise<void> {
    if (!job.callback_url) return;

    const secret = process.env.INCUBRIX_CALLBACK_SECRET || 'incubrix_default_secret';
    const payload = JSON.stringify(job);
    const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

    await axios.post(job.callback_url, job, {
      headers: {
        'Content-Type': 'application/json',
        'X-IncuBrix-Signature': signature
      },
      timeout: 5000
    });
  }
}

export const globalJobManager = new JobManager();
