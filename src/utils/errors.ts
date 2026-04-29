import { GraphQLError } from 'graphql';

export enum ErrorCode {
  NOT_FOUND = 'NOT_FOUND',
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  INVALID_INPUT = 'INVALID_INPUT',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  MAX_DEPTH_EXCEEDED = 'MAX_DEPTH_EXCEEDED',
  CATEGORY_INACTIVE = 'CATEGORY_INACTIVE',
}

const errorStatusMap: Record<ErrorCode, number> = {
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.ALREADY_EXISTS]: 409,
  [ErrorCode.INVALID_INPUT]: 400,
  [ErrorCode.INTERNAL_ERROR]: 500,
  [ErrorCode.MAX_DEPTH_EXCEEDED]: 400,
  [ErrorCode.CATEGORY_INACTIVE]: 400,
};

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = errorStatusMap[code];
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export function toGraphQLError(error: unknown): GraphQLError {
  if (error instanceof AppError) {
    return new GraphQLError(error.message, {
      extensions: {
        code: error.code,
        statusCode: error.statusCode,
        details: error.details,
      },
    });
  }

  if (error instanceof GraphQLError) return error;

  const message =
    error instanceof Error ? error.message : 'An unexpected error occurred';

  return new GraphQLError(message, {
    extensions: {
      code: ErrorCode.INTERNAL_ERROR,
      statusCode: 500,
    },
  });
}
