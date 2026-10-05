export type ResponseMeta = Record<string, unknown>;

export type SuccessResponse<
  TData = unknown,
  TMeta extends ResponseMeta = ResponseMeta,
> = {
  success: true;
  message: string;
  data: TData;
  meta?: TMeta;
};

export type ErrorResponse<TDetails = unknown> = {
  success: false;
  message: string;
  statusCode: number;
  details?: TDetails;
};

export type StandardResponse<
  TData = unknown,
  TDetails = unknown,
  TMeta extends ResponseMeta = ResponseMeta,
> = SuccessResponse<TData, TMeta> | ErrorResponse<TDetails>;

export type PaginationMeta = {
  nextCursor?: string | null;
  hasMore?: boolean;
  total?: number;
  page?: number;
  limit?: number;
};

export const DEFAULT_SUCCESS_MESSAGE = "Operation completed successfully.";

export const DEFAULT_ERROR_MESSAGE = "Request failed.";

export function success<TData, TMeta extends ResponseMeta = ResponseMeta>(
  data: TData,
  message = DEFAULT_SUCCESS_MESSAGE,
  meta?: TMeta,
): SuccessResponse<TData, TMeta> {
  const response: SuccessResponse<TData, TMeta> = {
    success: true,
    message,
    data,
  };

  if (meta && Object.keys(meta).length > 0) {
    response.meta = meta;
  }

  return response;
}

export function paginated<TData>(
  data: TData,
  pagination: PaginationMeta,
  message = DEFAULT_SUCCESS_MESSAGE,
): SuccessResponse<TData, { pagination: PaginationMeta }> {
  return success(data, message, { pagination });
}

export function failure<TDetails = unknown>(
  statusCode: number,
  message = DEFAULT_ERROR_MESSAGE,
  details?: TDetails,
): ErrorResponse<TDetails> {
  const response: ErrorResponse<TDetails> = {
    success: false,
    statusCode,
    message,
  };

  if (details !== undefined) {
    response.details = details;
  }

  return response;
}

export function isStandardResponse(value: unknown): value is StandardResponse {
  if (
    !isRecord(value) ||
    typeof value.success !== "boolean" ||
    typeof value.message !== "string"
  ) {
    return false;
  }

  if (value.success) {
    return value.data !== undefined;
  }

  return typeof value.statusCode === "number";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
