/**
 * Error Handling Utilities
 *
 * Custom error classes and error handling helpers.
 */

/**
 * Base Pinecone API error
 */
export class PineconeApiError extends Error {
  public statusCode?: number;
  public code: string;
  public retryable: boolean;

  constructor(message: string, statusCode?: number, code?: string, retryable = false) {
    super(message);
    this.name = 'PineconeApiError';
    this.statusCode = statusCode;
    this.code = code || 'PINECONE_ERROR';
    this.retryable = retryable;
  }
}

/**
 * Rate limit exceeded error
 */
export class RateLimitError extends PineconeApiError {
  public retryAfterSeconds: number;

  constructor(message: string, retryAfterSeconds: number) {
    super(message, 429, 'RATE_LIMIT_EXCEEDED', true);
    this.name = 'RateLimitError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/**
 * Authentication error
 */
export class AuthenticationError extends PineconeApiError {
  constructor(message: string) {
    super(message, 401, 'AUTHENTICATION_FAILED', false);
    this.name = 'AuthenticationError';
  }
}

/**
 * Not found error
 */
export class NotFoundError extends PineconeApiError {
  constructor(entityType: string, id: string) {
    super(`${entityType} '${id}' not found`, 404, 'NOT_FOUND', false);
    this.name = 'NotFoundError';
  }
}

/**
 * Validation error
 */
export class ValidationError extends PineconeApiError {
  public details: Record<string, string[]>;

  constructor(message: string, details: Record<string, string[]> = {}) {
    super(message, 400, 'VALIDATION_ERROR', false);
    this.name = 'ValidationError';
    this.details = details;
  }
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof PineconeApiError) {
    return error.retryable;
  }
  if (error instanceof Error) {
    // Network errors are typically retryable
    return (
      error.message.includes('network') ||
      error.message.includes('timeout') ||
      error.message.includes('ECONNRESET')
    );
  }
  return false;
}

/**
 * Format an error for logging
 */
export function formatErrorForLogging(error: unknown): Record<string, unknown> {
  if (error instanceof PineconeApiError) {
    return {
      name: error.name,
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      retryable: error.retryable,
      ...(error instanceof RateLimitError && { retryAfterSeconds: error.retryAfterSeconds }),
      ...(error instanceof ValidationError && { details: error.details }),
    };
  }
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }
  return { error: String(error) };
}
