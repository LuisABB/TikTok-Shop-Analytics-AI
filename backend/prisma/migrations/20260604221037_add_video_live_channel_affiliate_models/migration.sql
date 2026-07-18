-- CreateTable
CREATE TABLE "videos" (
    "id" SERIAL NOT NULL,
    "video_id" TEXT NOT NULL,
    "video_title" TEXT,
    "video_caption" TEXT,
    "creator_name" TEXT,
    "creator_id" TEXT,
    "published_at" TIMESTAMP(3) NOT NULL,
    "vv" INTEGER,
    "completion_rate" DECIMAL(10,8),
    "likes" INTEGER,
    "comments" INTEGER,
    "shares" INTEGER,
    "new_followers" INTEGER,
    "product_impressions" INTEGER,
    "product_clicks" INTEGER,
    "ctr" DECIMAL(10,8),
    "ctor" DECIMAL(10,8),
    "gmv" DECIMAL(15,2),
    "orders" INTEGER,
    "gpm" DECIMAL(15,4),
    "video_to_live_clicks" INTEGER,
    "video_to_live_rate" DECIMAL(10,8),
    "diagnosis" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "videos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video_products" (
    "id" SERIAL NOT NULL,
    "video_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,

    CONSTRAINT "video_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "live_sessions" (
    "id" SERIAL NOT NULL,
    "live_id" TEXT,
    "session_title" TEXT,
    "start_time" TIMESTAMP(3) NOT NULL,
    "duration_sec" INTEGER,
    "viewers" INTEGER,
    "avg_viewing_duration_sec" DOUBLE PRECISION,
    "avg_viewing_per_viewer" DOUBLE PRECISION,
    "likes" INTEGER,
    "comments" INTEGER,
    "shares" INTEGER,
    "new_followers" INTEGER,
    "follow_rate" DECIMAL(10,8),
    "comment_rate" DECIMAL(10,8),
    "share_rate" DECIMAL(10,8),
    "like_rate" DECIMAL(10,8),
    "product_impressions" INTEGER,
    "product_clicks" INTEGER,
    "impressions_per_hour" INTEGER,
    "gmv" DECIMAL(15,2),
    "gmv_per_hour" DECIMAL(15,2),
    "show_gpm" DECIMAL(15,4),
    "watch_gpm" DECIMAL(15,4),
    "orders" INTEGER,
    "items_sold" INTEGER,
    "customers" INTEGER,
    "aov" DECIMAL(15,2),
    "ctr" DECIMAL(10,8),
    "ctor" DECIMAL(10,8),
    "ads_roas" DECIMAL(15,4),
    "ads_cost" DECIMAL(15,2),
    "ads_gmv" DECIMAL(15,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "live_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_performance" (
    "id" SERIAL NOT NULL,
    "report_date" TIMESTAMP(3) NOT NULL,
    "channel" TEXT NOT NULL,
    "gmv" DECIMAL(15,2),
    "orders" INTEGER,
    "items_sold" INTEGER,
    "customers" INTEGER,
    "aov" DECIMAL(15,2),
    "impressions" INTEGER,
    "clicks" INTEGER,
    "ctr" DECIMAL(10,8),
    "add_to_cart" INTEGER,
    "ctor" DECIMAL(10,8),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "channel_performance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_products" (
    "id" SERIAL NOT NULL,
    "product_id" TEXT NOT NULL,
    "report_period" TEXT NOT NULL,
    "gross_revenue" DECIMAL(15,2),
    "commission" DECIMAL(15,2),
    "unit_sales" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "affiliate_products_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "videos_video_id_key" ON "videos"("video_id");

-- CreateIndex
CREATE INDEX "videos_published_at_idx" ON "videos"("published_at");

-- CreateIndex
CREATE INDEX "videos_creator_id_idx" ON "videos"("creator_id");

-- CreateIndex
CREATE UNIQUE INDEX "video_products_video_id_product_id_key" ON "video_products"("video_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "live_sessions_live_id_key" ON "live_sessions"("live_id");

-- CreateIndex
CREATE INDEX "live_sessions_start_time_idx" ON "live_sessions"("start_time");

-- CreateIndex
CREATE UNIQUE INDEX "channel_performance_report_date_channel_key" ON "channel_performance"("report_date", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "affiliate_products_product_id_report_period_key" ON "affiliate_products"("product_id", "report_period");

-- AddForeignKey
ALTER TABLE "video_products" ADD CONSTRAINT "video_products_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos"("video_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_products" ADD CONSTRAINT "video_products_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("product_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_products" ADD CONSTRAINT "affiliate_products_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("product_id") ON DELETE RESTRICT ON UPDATE CASCADE;
