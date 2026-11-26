-- Session whiteboard (spec 019): one persisted Excalidraw scene per Session.

-- CreateTable
CREATE TABLE "session_whiteboards" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "scene_data" JSONB NOT NULL,
    "scene_bytes" INTEGER NOT NULL,
    "updated_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "session_whiteboards_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "session_whiteboards_revision_check" CHECK ("revision" >= 0),
    CONSTRAINT "session_whiteboards_scene_bytes_check" CHECK ("scene_bytes" BETWEEN 0 AND 2097152),
    CONSTRAINT "session_whiteboards_scene_object_check" CHECK (jsonb_typeof("scene_data") = 'object')
);

-- CreateIndex
CREATE UNIQUE INDEX "session_whiteboards_session_id_key" ON "session_whiteboards"("session_id");

-- CreateIndex
CREATE INDEX "session_whiteboards_updated_by_user_id_idx" ON "session_whiteboards"("updated_by_user_id");

-- AddForeignKey
ALTER TABLE "session_whiteboards" ADD CONSTRAINT "session_whiteboards_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("session_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "session_whiteboards" ADD CONSTRAINT "session_whiteboards_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE RESTRICT;
