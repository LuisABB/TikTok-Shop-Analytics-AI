/*
  Warnings:

  - A unique constraint covering the columns `[report_date,agent_id]` on the table `service_metrics` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "service_metrics_report_date_key";

-- AlterTable
ALTER TABLE "service_metrics" ADD COLUMN     "agent_alias" TEXT,
ADD COLUMN     "agent_id" TEXT NOT NULL DEFAULT '',
ALTER COLUMN "avg_response_time_s" SET DATA TYPE DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "product_card_daily_metrics" (
    "id" SERIAL NOT NULL,
    "report_date" TIMESTAMP(3) NOT NULL,
    "views" INTEGER,
    "viewers" INTEGER,
    "clicks" INTEGER,
    "add_to_cart" INTEGER,
    "add_to_cart_users" INTEGER,
    "customers" INTEGER,
    "orders" INTEGER,
    "gmv" DECIMAL(15,2),
    "conversion_rate" DECIMAL(10,8),
    "ctr" DECIMAL(10,8),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_card_daily_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "product_card_daily_metrics_report_date_key" ON "product_card_daily_metrics"("report_date");

-- CreateIndex
CREATE UNIQUE INDEX "service_metrics_report_date_agent_id_key" ON "service_metrics"("report_date", "agent_id");
