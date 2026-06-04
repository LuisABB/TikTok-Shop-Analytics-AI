-- CreateTable
CREATE TABLE "channel_search_metrics" (
    "id" SERIAL NOT NULL,
    "report_date" TIMESTAMP(3) NOT NULL,
    "gmv" DECIMAL(15,2),
    "aov" DECIMAL(15,2),
    "orders" INTEGER,
    "customers" INTEGER,
    "impressions" INTEGER,
    "clicks" INTEGER,
    "add_to_cart_users" INTEGER,
    "conversion_rate" DECIMAL(10,8),
    "ctr" DECIMAL(10,8),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "channel_search_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "channel_search_metrics_report_date_key" ON "channel_search_metrics"("report_date");
