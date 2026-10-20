import {
  Body,
  Controller,
  Get,
  Headers,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import type { Response } from "express";
import {
  CurrentIdentity,
  IdentityGuard,
  type IdentityRequest,
} from "../../../../shared/auth/identity.guard";
import type { Principal } from "../../../auth/application/services/sessions.service";
import {
  ApiErrorResponse,
  ApiSuccessResponse,
} from "../../../../shared/http/api-response.decorators";
import { paginated, success } from "../../../../shared/http/response";
import { skillCommand } from "../../../skills/presentation/http/skills.controller";
import { CreatePaymentUseCase } from "../../application/use-cases/create-payment.use-case";
import { CancelPaymentUseCase } from "../../application/use-cases/cancel-payment.use-case";
import { ReadPaymentsUseCase } from "../../application/use-cases/read-payments.use-case";
import { PaymentReceiptsService } from "../../application/services/payment-receipts.service";
import {
  CreatePaymentDto,
  PaymentQueryDto,
  PaymentResponse,
  PaymentCreationPolicyResponse,
} from "./payments.dto";

@ApiTags("payments")
@ApiBearerAuth()
@UseGuards(IdentityGuard)
@ApiErrorResponse(400)
@ApiErrorResponse(401)
@ApiErrorResponse(403)
@ApiErrorResponse(404)
@ApiErrorResponse(409)
@ApiErrorResponse(429)
@ApiErrorResponse(503)
@Controller({ path: "payments", version: "1" })
export class PaymentsController {
  constructor(
    private readonly createPayment: CreatePaymentUseCase,
    private readonly reads: ReadPaymentsUseCase,
    private readonly cancelPayment: CancelPaymentUseCase,
  ) {}
  @Post()
  @Header("Cache-Control", "no-store")
  @ApiSuccessResponse(201, PaymentResponse)
  @ApiSuccessResponse(200, PaymentResponse)
  @ApiHeader({ name: "Idempotency-Key", required: true })
  @ApiOperation({
    summary: "Create own QR-only payOS top-up (201 fresh, 200 replay)",
    description:
      "CREATED with checkout:null means preparation is in progress. Read detail again or listen to payment.updated via /events. Only a verified payment credits the wallet.",
  })
  async create(
    @Req() req: IdentityRequest,
    @Headers("idempotency-key") key: string | undefined,
    @CurrentIdentity() principal: Principal,
    @Body() input: CreatePaymentDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.createPayment.execute(
      skillCommand(req, key, principal),
      input,
    );
    response.status(result.replayed ? 200 : 201);
    return success(result.data);
  }
  @Get()
  @Header("Cache-Control", "no-store")
  @ApiSuccessResponse(200, PaymentResponse, { paginated: true })
  @ApiOperation({ summary: "List own payment orders in stable order" })
  async list(
    @CurrentIdentity() principal: Principal,
    @Query() query: PaymentQueryDto,
  ) {
    const result = await this.reads.list(principal, query);
    return paginated(result.data, result.pagination);
  }
  @Get("creation-policy")
  @Header("Cache-Control", "no-store")
  @ApiSuccessResponse(200, PaymentCreationPolicyResponse)
  @ApiOperation({
    summary: "Read current own payment creation gate; does not contact payOS",
  })
  async creationPolicy(@CurrentIdentity() principal: Principal) {
    return success(await this.reads.creationPolicy(principal));
  }
  @Get(":id")
  @Header("Cache-Control", "no-store")
  @ApiSuccessResponse(200, PaymentResponse)
  @ApiOperation({ summary: "Read one own payment and pending QR" })
  async detail(
    @CurrentIdentity() principal: Principal,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return success(await this.reads.detail(principal, id));
  }

  @Post(":paymentId/cancel")
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  @ApiHeader({ name: "Idempotency-Key", required: true })
  @ApiSuccessResponse(200, PaymentResponse)
  @ApiOperation({
    summary: "Cancel own unpaid payOS top-up",
    description:
      "No body. Verifies the signed payOS response before confirming cancellation. PAID/REVIEW cannot be cancelled. A timeout is not cancellation proof; retry with the same key and read the payment status. An active checkout lease returns 409 PAYMENT_CHECKOUT_BUSY.",
  })
  async cancel(
    @Req() req: IdentityRequest,
    @Headers("idempotency-key") key: string | undefined,
    @CurrentIdentity() principal: Principal,
    @Param("paymentId", ParseUUIDPipe) paymentId: string,
  ) {
    return success(
      await this.cancelPayment.execute(
        skillCommand(req, key, principal),
        paymentId,
      ),
    );
  }
}
@ApiTags("payments")
@ApiErrorResponse(400)
@ApiErrorResponse(401)
@ApiErrorResponse(503)
@Controller({ path: "payments/webhooks/payos", version: "1" })
export class PayosWebhookController {
  constructor(private readonly receipts: PaymentReceiptsService) {}
  @Post()
  @HttpCode(200)
  @ApiOperation({
    summary: "payOS signed webhook; durable acknowledgement, no bearer token",
    description:
      "The data signature is mandatory. Unknown/sample, mismatched or late transactions enter REVIEW without issuing Credit. Provider retries are safe.",
  })
  @ApiBody({
    schema: {
      type: "object",
      required: ["code", "success", "data", "signature"],
      properties: {
        code: { type: "string" },
        success: { type: "boolean" },
        data: { type: "object", additionalProperties: true },
        signature: { type: "string" },
      },
    },
  })
  @ApiResponse({
    status: 200,
    schema: {
      type: "object",
      properties: { success: { type: "boolean", example: true } },
    },
  })
  async webhook(@Body() body: unknown) {
    await this.receipts.webhook(body);
    return { success: true };
  }
}
