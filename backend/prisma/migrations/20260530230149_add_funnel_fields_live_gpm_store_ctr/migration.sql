-- AlterTable
ALTER TABLE "core_metrics" ADD COLUMN     "add_to_cart_users" INTEGER,
ADD COLUMN     "clicks" INTEGER,
ADD COLUMN     "conversion_rate" DECIMAL(10,8),
ADD COLUMN     "impressions" INTEGER;

-- AlterTable
ALTER TABLE "live_metrics" ADD COLUMN     "gpm" DECIMAL(15,4);

-- AlterTable
ALTER TABLE "store_metrics" ADD COLUMN     "ctr" DECIMAL(10,8);
