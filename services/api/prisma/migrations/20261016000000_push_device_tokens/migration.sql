-- CreateTable
CREATE TABLE "push_device_tokens" (
    "push_device_token_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ(3),

    CONSTRAINT "push_device_tokens_pkey" PRIMARY KEY ("push_device_token_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "push_device_tokens_token_key" ON "push_device_tokens"("token");

-- CreateIndex
CREATE INDEX "push_device_tokens_user_id_idx" ON "push_device_tokens"("user_id");

-- AddForeignKey
ALTER TABLE "push_device_tokens" ADD CONSTRAINT "push_device_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

