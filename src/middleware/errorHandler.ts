import { Request, Response, NextFunction } from 'express';
import { IncuBrixErrorResponse, SharedErrorCode } from '../types/contract.js';
import { Logger } from '../utils/logger.js';

export class AppError extends Error {
  public code: SharedErrorCode | string;
  public statusCode: number;
  public retryable: boolean;
  public details?: any;

  constructor(
    code: SharedErrorCode | string,
    message: string,
    statusCode: number = 400,
    retryable: boolean = false,
    details?: any
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.retryable = retryable;
    this.details = details;
  }
}

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const correlationId = req.correlationId;

  if (err instanceof AppError) {
    Logger.warn(`AppError [${err.code}]: ${err.message}`, {
      correlation_id: correlationId,
      code: err.code,
      details: err.details
    });

    const response: IncuBrixErrorResponse = {
      error: {
        code: err.code,
        message: err.message,
        retryable: err.retryable,
        details: err.details
      }
    };
    res.status(err.statusCode).json(response);
    return;
  }

  // Handle generic / unexpected errors
  Logger.error(`Unhandled Exception: ${err.message}`, {
    correlation_id: correlationId,
    stack: err.stack
  });

  const response: IncuBrixErrorResponse = {
    error: {
      code: 'PLATFORM_UNAVAILABLE',
      message: err.message || 'An unexpected internal error occurred',
      retryable: true,
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    }
  };

  res.status(500).json(response);
}
