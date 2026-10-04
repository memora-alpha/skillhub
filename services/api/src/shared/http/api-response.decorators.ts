import { applyDecorators, Type } from "@nestjs/common";
import { ApiExtraModels, ApiResponse, getSchemaPath } from "@nestjs/swagger";

export function ApiSuccessResponse(
  status: number,
  model: Type<unknown> | null,
  options: { paginated?: boolean } = {},
) {
  const data = model
    ? { $ref: getSchemaPath(model) }
    : { type: "object" as const, nullable: true, enum: [null] };
  return applyDecorators(
    ...(model ? [ApiExtraModels(model)] : []),
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
          data: options.paginated ? { type: "array", items: data } : data,
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
    schema: {
      type: "object",
      required: ["success", "message", "statusCode"],
      properties: {
        success: { type: "boolean", enum: [false] },
        message: { type: "string" },
        statusCode: { type: "integer", enum: [status] },
      },
    },
  });
}
