-- Migration was applied directly to the database before being recorded locally.
-- These columns already exist in the production database.
-- Stub created to resolve Prisma drift detection.
ALTER TABLE "game_states" ADD COLUMN IF NOT EXISTS "currency_y" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "game_states" ADD COLUMN IF NOT EXISTS "ectoplasm" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "game_states" ADD COLUMN IF NOT EXISTS "essence" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "game_states" ADD COLUMN IF NOT EXISTS "evo_active" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "game_states" ADD COLUMN IF NOT EXISTS "evo_ends_at" TIMESTAMP(3);
ALTER TABLE "game_states" ADD COLUMN IF NOT EXISTS "evo_level" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "game_states" ADD COLUMN IF NOT EXISTS "loc2_upgrades" JSONB;
ALTER TABLE "game_states" ADD COLUMN IF NOT EXISTS "mutagen1" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "game_states" ADD COLUMN IF NOT EXISTS "mutagen2" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "game_states" ADD COLUMN IF NOT EXISTS "mutagen3" INTEGER NOT NULL DEFAULT 0;
