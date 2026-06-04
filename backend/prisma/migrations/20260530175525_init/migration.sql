-- CreateTable
CREATE TABLE "reports" (
    "id" SERIAL NOT NULL,
    "report_type" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "import_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "row_count" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" SERIAL NOT NULL,
    "product_id" TEXT NOT NULL,
    "product_name" TEXT NOT NULL,
    "status" TEXT,
    "category" TEXT,
    "price" DECIMAL(15,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_metrics" (
    "id" SERIAL NOT NULL,
    "product_id" TEXT NOT NULL,
    "report_date" TIMESTAMP(3) NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'all',
    "gmv" DECIMAL(15,2),
    "orders" INTEGER,
    "customers" INTEGER,
    "impressions" INTEGER,
    "views" INTEGER,
    "clicks" INTEGER,
    "add_to_cart" INTEGER,
    "conversion_rate" DECIMAL(10,8),
    "ctr" DECIMAL(10,8),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_metrics" (
    "id" SERIAL NOT NULL,
    "report_date" TIMESTAMP(3) NOT NULL,
    "visitors" INTEGER,
    "page_views" INTEGER,
    "conversion_rate" DECIMAL(10,8),
    "gmv" DECIMAL(15,2),
    "orders" INTEGER,
    "customers" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "store_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core_metrics" (
    "id" SERIAL NOT NULL,
    "report_date" TIMESTAMP(3) NOT NULL,
    "gmv" DECIMAL(15,2),
    "orders" INTEGER,
    "customers" INTEGER,
    "items_sold" INTEGER,
    "aov" DECIMAL(15,2),
    "new_customers" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "core_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video_metrics" (
    "id" SERIAL NOT NULL,
    "report_date" TIMESTAMP(3) NOT NULL,
    "video_id" TEXT,
    "video_title" TEXT,
    "author" TEXT,
    "vv" INTEGER,
    "ctr" DECIMAL(10,8),
    "ctor" DECIMAL(10,8),
    "gmv" DECIMAL(15,2),
    "orders" INTEGER,
    "gpm" DECIMAL(15,4),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "video_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "live_metrics" (
    "id" SERIAL NOT NULL,
    "report_date" TIMESTAMP(3) NOT NULL,
    "live_id" TEXT,
    "live_title" TEXT,
    "viewers" INTEGER,
    "peak_viewers" INTEGER,
    "ctr" DECIMAL(10,8),
    "ctor" DECIMAL(10,8),
    "gmv" DECIMAL(15,2),
    "orders" INTEGER,
    "duration_min" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "live_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_metrics" (
    "id" SERIAL NOT NULL,
    "report_date" TIMESTAMP(3) NOT NULL,
    "assigned_chats" INTEGER,
    "resolved_chats" INTEGER,
    "response_rate" DECIMAL(10,8),
    "satisfaction_rate" DECIMAL(10,8),
    "avg_response_time_s" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_metrics" (
    "id" SERIAL NOT NULL,
    "report_date" TIMESTAMP(3) NOT NULL,
    "product_id" TEXT,
    "keyword" TEXT,
    "impressions" INTEGER,
    "clicks" INTEGER,
    "ctr" DECIMAL(10,8),
    "orders" INTEGER,
    "conversion_rate" DECIMAL(10,8),
    "gmv" DECIMAL(15,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "products_product_id_key" ON "products"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_metrics_product_id_report_date_channel_key" ON "product_metrics"("product_id", "report_date", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "store_metrics_report_date_key" ON "store_metrics"("report_date");

-- CreateIndex
CREATE UNIQUE INDEX "core_metrics_report_date_key" ON "core_metrics"("report_date");

-- CreateIndex
CREATE UNIQUE INDEX "service_metrics_report_date_key" ON "service_metrics"("report_date");

-- AddForeignKey
ALTER TABLE "product_metrics" ADD CONSTRAINT "product_metrics_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("product_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "search_metrics" ADD CONSTRAINT "search_metrics_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("product_id") ON DELETE SET NULL ON UPDATE CASCADE;
