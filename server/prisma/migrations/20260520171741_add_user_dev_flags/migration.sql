-- AlterTable
ALTER TABLE "users" ADD COLUMN     "dev_flags" TEXT[] DEFAULT ARRAY[]::TEXT[];
