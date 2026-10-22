import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from "@nestjs/swagger";
import { Readable } from "node:stream";
import {
  CurrentIdentity,
  IdentityGuard,
  type IdentityRequest,
} from "../../../../shared/auth/identity.guard";
import { getOrCreateRequestContext } from "../../../../shared/http/request-context";
import { success } from "../../../../shared/http/response";
import type { Principal } from "../../../auth/application/services/sessions.service";
import { MaterialsService } from "../../application/services/materials.service";
import { CreateMaterialDto, UpdateMaterialDto } from "./materials.dto";

@ApiTags("materials")
@ApiBearerAuth()
@UseGuards(IdentityGuard)
@Controller({ path: "me/materials", version: "1" })
export class MyMaterialsController {
  constructor(private readonly materials: MaterialsService) {}

  @Post("files")
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: ["file"],
      properties: { file: { type: "string", format: "binary" } },
    },
  })
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: 20_000_000, files: 1, fields: 0 },
    }),
  )
  async upload(
    @Req() req: IdentityRequest,
    @CurrentIdentity() actor: Principal,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) throw new BadRequestException("FILE_REQUIRED");
    return success(
      await this.materials.upload(actor, {
        name: file.originalname,
        claimedMime: file.mimetype,
        body: Readable.from(file.buffer),
        correlationId: getOrCreateRequestContext(req).correlationId,
      }),
      "Material file upload accepted.",
    );
  }

  @Get("files/:fileId")
  async fileStatus(
    @CurrentIdentity() actor: Principal,
    @Param("fileId", ParseUUIDPipe) fileId: string,
  ) {
    return success(await this.materials.fileStatus(actor, fileId));
  }

  @Get()
  async mine(@CurrentIdentity() actor: Principal) {
    return success(await this.materials.listMine(actor));
  }

  @Post()
  async create(
    @CurrentIdentity() actor: Principal,
    @Body() body: CreateMaterialDto,
  ) {
    return success(
      await this.materials.create(actor, body),
      "Material draft created.",
    );
  }

  @Patch(":materialId")
  async update(
    @CurrentIdentity() actor: Principal,
    @Param("materialId", ParseUUIDPipe) id: string,
    @Body() body: UpdateMaterialDto,
  ) {
    return success(
      await this.materials.update(actor, id, body),
      "Material updated.",
    );
  }

  @Post(":materialId/submit")
  async submit(
    @CurrentIdentity() actor: Principal,
    @Param("materialId", ParseUUIDPipe) id: string,
  ) {
    return success(
      await this.materials.submit(actor, id),
      "Material submitted for review.",
    );
  }

  @Post(":materialId/archive")
  async archive(
    @CurrentIdentity() actor: Principal,
    @Param("materialId", ParseUUIDPipe) id: string,
  ) {
    return success(
      await this.materials.archive(actor, id),
      "Material archived.",
    );
  }
}
