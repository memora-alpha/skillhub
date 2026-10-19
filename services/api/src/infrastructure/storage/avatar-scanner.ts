import { AvatarScannerPort } from "../../modules/users/application/ports/avatar-providers";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createConnection } from "node:net";

@Injectable()
export class AvatarScanner extends AvatarScannerPort {
  private readonly host: string;
  private readonly port: number;
  constructor(config: ConfigService) {
    super();
    this.host = config.getOrThrow<string>("CLAMAV_HOST");
    this.port = Number(config.getOrThrow("CLAMAV_PORT"));
    if (
      !this.host ||
      !Number.isInteger(this.port) ||
      this.port < 1 ||
      this.port > 65535
    )
      throw new Error("Invalid scanner configuration");
  }
  scan(data: Buffer): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const socket = createConnection({ host: this.host, port: this.port });
      let response = "";
      let done = false;
      const finish = (error?: Error) => {
        if (done) return;
        done = true;
        socket.destroy();
        if (error) reject(error);
        else if (response.replaceAll("\0", "").trim() === "stream: OK")
          resolve(true);
        else if (/ FOUND/.test(response)) resolve(false);
        else reject(new Error("SCAN_FAILED"));
      };
      socket.setTimeout(15000, () => finish(new Error("SCAN_TIMEOUT")));
      socket.on("error", () => finish(new Error("SCAN_UNAVAILABLE")));
      socket.on("connect", () => {
        socket.write("zINSTREAM\0");
        for (let offset = 0; offset < data.length; offset += 65536) {
          const chunk = data.subarray(offset, offset + 65536);
          const size = Buffer.alloc(4);
          size.writeUInt32BE(chunk.length);
          socket.write(size);
          socket.write(chunk);
        }
        socket.write(Buffer.alloc(4));
      });
      socket.on("data", (chunk) => {
        response += chunk.toString("utf8");
        if (response.length > 2048) finish(new Error("SCAN_INVALID_RESPONSE"));
        else if (response.includes("\0")) finish();
      });
      socket.on("end", () => finish());
    });
  }
}
