// Structured JSON logger with automatic token & secret masking (Must-Have 7 & Integration Standard 8)

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const SENSITIVE_KEYS = [
  'token',
  'api_key',
  'apikey',
  'authorization',
  'secret',
  'password',
  'ghost_admin_api_key',
  'bearer'
];

export function maskSecrets(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') {
    // Mask potential bearer tokens or long keys
    if (obj.length > 20 && (/^[A-Za-z0-9_\-\.]+$/.test(obj) || obj.startsWith('Bearer '))) {
      return `${obj.substring(0, 4)}...[REDACTED]`;
    }
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(maskSecrets);
  }
  if (typeof obj === 'object') {
    const masked: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (SENSITIVE_KEYS.some((s) => key.toLowerCase().includes(s))) {
        masked[key] = '[REDACTED_SECRET]';
      } else {
        masked[key] = maskSecrets(value);
      }
    }
    return masked;
  }
  return obj;
}

export class Logger {
  public static log(level: LogLevel, message: string, meta: Record<string, any> = {}) {
    const correlationId = meta.correlation_id || meta.correlationId || meta['X-Correlation-Id'] || undefined;
    const jobId = meta.job_id || meta.jobId || undefined;

    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      correlation_id: correlationId,
      'X-Correlation-Id': correlationId,
      job_id: jobId,
      ...maskSecrets(meta)
    };
    // Print structured JSON
    const jsonStr = JSON.stringify(entry);
    if (level === 'error') {
      console.error(jsonStr);
    } else if (level === 'warn') {
      console.warn(jsonStr);
    } else {
      console.log(jsonStr);
    }
  }

  public static info(message: string, meta?: Record<string, any>) {
    this.log('info', message, meta);
  }

  public static warn(message: string, meta?: Record<string, any>) {
    this.log('warn', message, meta);
  }

  public static error(message: string, meta?: Record<string, any>) {
    this.log('error', message, meta);
  }

  public static debug(message: string, meta?: Record<string, any>) {
    this.log('debug', message, meta);
  }
}
