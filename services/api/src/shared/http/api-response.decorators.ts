import { applyDecorators, Type } from "@nestjs/common";
import { ApiExtraModels, ApiResponse, getSchemaPath } from "@nestjs/swagger";

export function ApiSuccessResponse(
  status: number,
  model: Type<unknown> | readonly Type<unknown>[] | null,
  options: { paginated?: boolean; isArray?: boolean } = {},
) {
  let models: readonly Type<unknown>[] = [];
  if (Array.isArray(model)) {
    models = model;
  } else if (model !== null) {
    models = [model as Type<unknown>];
  }
  const singleModelSchema = models[0]
    ? { $ref: getSchemaPath(models[0]) }
    : { type: "object" as const, nullable: true, enum: [null] };
  const data =
    models.length > 1
      ? { oneOf: models.map((entry) => ({ $ref: getSchemaPath(entry) })) }
      : singleModelSchema;
  return applyDecorators(
    ...(models.length > 0 ? [ApiExtraModels(...models)] : []),
    ApiResponse({
      status,
      schema: {
        type: "object",
        required: [
          "success",
          "message",
          "data",
          ...(options.paginated ? ["meta"] : []),
        ],
        properties: {
          success: { type: "boolean", enum: [true] },
          message: { type: "string" },
          data:
            options.paginated || options.isArray
              ? { type: "array", items: data }
              : data,
          ...(options.paginated
            ? {
                meta: {
                  type: "object" as const,
                  required: ["pagination"],
                  properties: {
                    pagination: {
                      type: "object" as const,
                      required: ["nextCursor", "hasMore", "limit"],
                      properties: {
                        nextCursor: { type: "string" as const, nullable: true },
                        hasMore: { type: "boolean" as const },
                        limit: {
                          type: "integer" as const,
                          minimum: 1,
                          maximum: 100,
                        },
                      },
                    },
                  },
                },
              }
            : {}),
        },
      },
    }),
  );
}

export function ApiErrorResponse(status: number, description?: string) {
  return ApiResponse({
    status,
    description,
    ...(status === 429
      ? {
          headers: {
            "Retry-After": {
              description:
                "Advisory seconds before retry; concurrent traffic or SSE lease renewals may extend the wait.",
              schema: { type: "integer", minimum: 1 },
            },
          },
        }
      : {}),
    schema: {
      type: "object",
      required: ["success", "message", "statusCode"],
      properties: {
        success: { type: "boolean", enum: [false] },
        message: { type: "string" },
        statusCode: { type: "integer", enum: [status] },
        ...(status === 429
          ? {
              details: {
                type: "object",
                required: [
                  "limiter",
                  "scope",
                  "dimension",
                  "retryAfterSeconds",
                  "resetAt",
                ],
                properties: {
                  limiter: { type: "string" },
                  scope: { type: "string" },
                  dimension: { type: "string" },
                  retryAfterSeconds: { type: "integer", minimum: 1 },
                  resetAt: { type: "string", format: "date-time" },
                },
              },
            }
          : {}),
      },
    },
  });
}
