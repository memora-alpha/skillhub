import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { PrismaService } from "./prisma.service";
import { TransactionRunner } from "./transaction-runner";

@Module({
  imports: [
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.getOrThrow<string>("MONGODB_URI"),
        serverSelectionTimeoutMS: 5000,
        retryAttempts: 1,
        autoIndex: config.get<string>("NODE_ENV") !== "production",
      }),
    }),
  ],
  providers: [
    PrismaService,
    {
      provide: TransactionRunner,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) => new TransactionRunner(prisma),
    },
  ],
  exports: [PrismaService, TransactionRunner, MongooseModule],
})
export class DatabaseModule {}
