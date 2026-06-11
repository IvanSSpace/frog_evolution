-- AddColumn: universe restart prestige fields
-- Phase 31: Universe Restart (prestige)
-- Additive migration — existing rows get default 0, no data loss.

ALTER TABLE "game_states" ADD COLUMN IF NOT EXISTS "universe_restart_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "game_states" ADD COLUMN IF NOT EXISTS "base_tier" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "game_states" ADD COLUMN IF NOT EXISTS "l19_count" INTEGER NOT NULL DEFAULT 0;
