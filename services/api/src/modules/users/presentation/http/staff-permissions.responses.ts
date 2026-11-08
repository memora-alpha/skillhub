import { ApiProperty } from "@nestjs/swagger";

export class StaffPermissionCatalogResponse {
  @ApiProperty() code!: string;
  @ApiProperty({ type: String, nullable: true }) description!: string | null;
}

export class StaffPermissionOverrideResponse {
  @ApiProperty() code!: string;
  @ApiProperty({ enum: ["GRANT", "DENY"] }) effect!: string;
  @ApiProperty({ type: String, format: "date-time" }) updatedAt!: string;
  @ApiProperty({ format: "uuid" }) updatedBy!: string;
}

export class StaffPermissionVersionResponse {
  @ApiProperty({ format: "uuid" }) userId!: string;
  @ApiProperty({ minimum: 0 }) version!: number;
}

export class StaffPermissionsResponse extends StaffPermissionVersionResponse {
  @ApiProperty({ type: [String] }) effectivePermissions!: string[];
  @ApiProperty({ type: [StaffPermissionOverrideResponse] })
  overrides!: StaffPermissionOverrideResponse[];
}
