-- CreateEnum
CREATE TYPE "ClanRole" AS ENUM ('LEADER', 'COLEADER', 'MEMBER');

-- CreateEnum
CREATE TYPE "ClanRequestType" AS ENUM ('SLIME', 'ESSENCE', 'SERUM');

-- CreateTable
CREATE TABLE "clans" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "emblem_icon" TEXT NOT NULL,
    "emblem_color" TEXT NOT NULL,
    "min_essence" INTEGER NOT NULL DEFAULT 0,
    "leader_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_activity_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clan_members" (
    "id" SERIAL NOT NULL,
    "clan_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "role" "ClanRole" NOT NULL DEFAULT 'MEMBER',
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clan_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clan_messages" (
    "id" SERIAL NOT NULL,
    "clan_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "text" VARCHAR(500) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clan_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clan_requests" (
    "id" SERIAL NOT NULL,
    "clan_id" INTEGER NOT NULL,
    "requester_id" INTEGER NOT NULL,
    "type" "ClanRequestType" NOT NULL,
    "element" TEXT,
    "target_amount" BIGINT NOT NULL,
    "current_amount" BIGINT NOT NULL DEFAULT 0,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clan_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clan_donations" (
    "id" SERIAL NOT NULL,
    "request_id" INTEGER NOT NULL,
    "donor_id" INTEGER NOT NULL,
    "amount" BIGINT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clan_donations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clan_pins" (
    "id" SERIAL NOT NULL,
    "clan_id" INTEGER NOT NULL,
    "author_id" INTEGER NOT NULL,
    "text" VARCHAR(300) NOT NULL,
    "mission_ref" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clan_pins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_clan_cooldowns" (
    "user_id" INTEGER NOT NULL,
    "until" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_clan_cooldowns_pkey" PRIMARY KEY ("user_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "clans_name_key" ON "clans"("name");

-- CreateIndex
CREATE INDEX "clans_last_activity_at_idx" ON "clans"("last_activity_at");

-- CreateIndex
CREATE UNIQUE INDEX "clan_members_user_id_key" ON "clan_members"("user_id");

-- CreateIndex
CREATE INDEX "clan_members_clan_id_idx" ON "clan_members"("clan_id");

-- CreateIndex
CREATE INDEX "clan_messages_clan_id_created_at_idx" ON "clan_messages"("clan_id", "created_at");

-- CreateIndex
CREATE INDEX "clan_requests_clan_id_created_at_idx" ON "clan_requests"("clan_id", "created_at");

-- CreateIndex
CREATE INDEX "clan_requests_expires_at_idx" ON "clan_requests"("expires_at");

-- CreateIndex
CREATE INDEX "clan_donations_request_id_idx" ON "clan_donations"("request_id");

-- CreateIndex
CREATE INDEX "clan_pins_clan_id_expires_at_idx" ON "clan_pins"("clan_id", "expires_at");

-- AddForeignKey
ALTER TABLE "clan_members" ADD CONSTRAINT "clan_members_clan_id_fkey" FOREIGN KEY ("clan_id") REFERENCES "clans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clan_members" ADD CONSTRAINT "clan_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clan_messages" ADD CONSTRAINT "clan_messages_clan_id_fkey" FOREIGN KEY ("clan_id") REFERENCES "clans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clan_messages" ADD CONSTRAINT "clan_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clan_requests" ADD CONSTRAINT "clan_requests_clan_id_fkey" FOREIGN KEY ("clan_id") REFERENCES "clans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clan_donations" ADD CONSTRAINT "clan_donations_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "clan_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clan_pins" ADD CONSTRAINT "clan_pins_clan_id_fkey" FOREIGN KEY ("clan_id") REFERENCES "clans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_clan_cooldowns" ADD CONSTRAINT "user_clan_cooldowns_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
