import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { connectionSettings } from "./connection-policy";
@Injectable()
export class ConnectionConfig {
  readonly policy;
  constructor(config: ConfigService) {
    this.policy = connectionSettings({
      sessionCountMax: config.get("CONNECTION_SESSION_COUNT_MAX"),
      oneWayMin: config.get("CONNECTION_ONE_WAY_MIN"),
      oneWayMax: config.get("CONNECTION_ONE_WAY_MAX"),
    });
  }
}
