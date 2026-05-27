-- CreateEnum
CREATE TYPE "ExpeditionStatus" AS ENUM ('OUTBOUND', 'RETURNING', 'CLAIMED', 'LOST');

-- CreateTable
CREATE TABLE "expeditions" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "seed" INTEGER NOT NULL,
    "status" "ExpeditionStatus" NOT NULL DEFAULT 'OUTBOUND',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recalled_at" TIMESTAMP(3),
    "arrival_at" TIMESTAMP(3),
    "claimed_at" TIMESTAMP(3),
    "tick_interval_sec" INTEGER NOT NULL DEFAULT 60,
    "ship_stats" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expeditions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "expeditions_user_id_status_idx" ON "expeditions"("user_id", "status");

-- AddForeignKey
ALTER TABLE "expeditions" ADD CONSTRAINT "expeditions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
