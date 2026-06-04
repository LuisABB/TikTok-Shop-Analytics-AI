/*
  Warnings:

  - You are about to drop the column `duration_min` on the `live_metrics` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "live_metrics" DROP COLUMN "duration_min",
ADD COLUMN     "duration_sec" INTEGER;
