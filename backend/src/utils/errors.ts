import { FastifyReply } from 'fastify';

export class AppError extends Error {
  public statusCode: number;
  public code: string;

  constructor(message: string, statusCode: number = 500, code: string = 'INTERNAL_ERROR') {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export class BadRequestError extends AppError {
  constructor(message: string = 'Bad Request') {
    super(message, 400, 'BAD_REQUEST');
    this.name = 'BadRequestError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 403, 'FORBIDDEN');
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Not Found') {
    super(message, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Conflict') {
    super(message, 409, 'CONFLICT');
    this.name = 'ConflictError';
  }
}

export class ValidationError extends AppError {
  public errors: Record<string, string[]>;

  constructor(message: string = 'Validation Error', errors: Record<string, string[]> = {}) {
    super(message, 422, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message: string = 'Too Many Requests') {
    super(message, 429, 'TOO_MANY_REQUESTS');
    this.name = 'TooManyRequestsError';
  }
}

export function handleError(error: unknown, reply: FastifyReply): void {
  if (error instanceof AppError) {
    reply.status(error.statusCode).send({
      success: false,
      error: error.code,
      message: error.message,
      ...(error instanceof ValidationError && { errors: error.errors }),
    });
    return;
  }

  if (error instanceof Error) {
    console.error('Unhandled error:', error);
    reply.status(500).send({
      success: false,
      error: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'development' 
        ? error.message 
        : 'An unexpected error occurred',
    });
    return;
  }

  reply.status(500).send({
    success: false,
    error: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred',
  });
}
