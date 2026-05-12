-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "telegram_id" TEXT NOT NULL,
    "username" TEXT,
    "first_name" TEXT,
    "last_name" TEXT,
    "photo_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_states" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "gold" BIGINT NOT NULL DEFAULT 0,
    "upgrades" JSONB NOT NULL DEFAULT '{"dropSpeed":0,"tractor":0,"magnet":0,"crateQuality":0,"rareBoxSpeed":0}',
    "frogPurchases" JSONB NOT NULL DEFAULT '[]',
    "discoveredLevels" JSONB NOT NULL DEFAULT '[1]',
    "magnet_enabled" BOOLEAN NOT NULL DEFAULT true,
    "current_location" INTEGER NOT NULL DEFAULT 1,
    "location_frogs" JSONB NOT NULL DEFAULT '[[1,2,3,4,5,6],[],[],[]]',
    "cosmic" JSONB,
    "last_session_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "game_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pity_states" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "rare" INTEGER NOT NULL DEFAULT 0,
    "epic" INTEGER NOT NULL DEFAULT 0,
    "legendary" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pity_states_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_telegram_id_key" ON "users"("telegram_id");

-- CreateIndex
CREATE UNIQUE INDEX "game_states_user_id_key" ON "game_states"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "pity_states_user_id_key" ON "pity_states"("user_id");

-- AddForeignKey
ALTER TABLE "game_states" ADD CONSTRAINT "game_states_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pity_states" ADD CONSTRAINT "pity_states_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
