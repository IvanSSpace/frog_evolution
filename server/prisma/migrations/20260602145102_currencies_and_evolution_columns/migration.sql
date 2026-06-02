-- AlterTable
ALTER TABLE "game_states" ADD COLUMN     "currency_y" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "ectoplasm" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "essence" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "evo_active" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "evo_ends_at" TIMESTAMP(3),
ADD COLUMN     "evo_level" INTEGER,
ADD COLUMN     "loc2_upgrades" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "mutagen1" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "mutagen2" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "mutagen3" INTEGER NOT NULL DEFAULT 0;

-- Backfill: перенос валют из старого cosmic JSON-блоба в новые колонки.
-- Идемпотентно (копирует только при cosmic IS NOT NULL; COALESCE для отсутствующих).
UPDATE "game_states" SET
  "ectoplasm"     = COALESCE(floor((cosmic->>'ectoplasm')::numeric)::bigint, 0),
  "currency_y"    = COALESCE(floor((cosmic->>'currencyY')::numeric)::int, 0),
  "essence"       = COALESCE(floor((cosmic->>'essence')::numeric)::int, 0),
  "mutagen1"      = COALESCE(floor((cosmic->>'mutagen1')::numeric)::int, 0),
  "mutagen2"      = COALESCE(floor((cosmic->>'mutagen2')::numeric)::int, 0),
  "mutagen3"      = COALESCE(floor((cosmic->>'mutagen3')::numeric)::int, 0),
  "loc2_upgrades" = COALESCE(cosmic->'loc2Upgrades', '{}'::jsonb)
WHERE cosmic IS NOT NULL;
