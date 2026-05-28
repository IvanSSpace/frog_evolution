-- AlterTable
ALTER TABLE "clans" DROP COLUMN "emblem_icon",
DROP COLUMN "emblem_color",
ADD COLUMN "emblem_variant" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "emblem_style" TEXT NOT NULL DEFAULT 'pond',
ADD COLUMN "emblem_bg" TEXT NOT NULL DEFAULT '#5e8b2a',
ADD COLUMN "emblem_frog" TEXT NOT NULL DEFAULT '#6aab3c',
ADD COLUMN "emblem_top_color" TEXT,
ADD COLUMN "emblem_stripe_color" TEXT;
