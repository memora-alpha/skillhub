CREATE TABLE "material_favorites" (
    "favorite_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "material_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "material_favorites_pkey" PRIMARY KEY ("favorite_id")
);

CREATE UNIQUE INDEX "material_favorites_user_id_material_id_key"
    ON "material_favorites"("user_id", "material_id");
CREATE INDEX "material_favorites_user_page_idx"
    ON "material_favorites"("user_id", "created_at" DESC, "favorite_id" DESC);
CREATE INDEX "material_favorites_material_id_idx"
    ON "material_favorites"("material_id");

ALTER TABLE "material_favorites"
    ADD CONSTRAINT "material_favorites_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("user_id")
    ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "material_favorites"
    ADD CONSTRAINT "material_favorites_material_id_fkey"
    FOREIGN KEY ("material_id") REFERENCES "materials"("material_id")
    ON DELETE RESTRICT ON UPDATE RESTRICT;
