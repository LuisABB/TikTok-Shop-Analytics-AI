-- CreateTable
CREATE TABLE "orders" (
    "id" SERIAL NOT NULL,
    "order_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "substatus" TEXT,
    "cancel_type" TEXT,
    "order_type" TEXT,
    "order_channel" TEXT,
    "creator_handle" TEXT,
    "buyer_username" TEXT,
    "order_amount" DECIMAL(15,2),
    "refund_amount" DECIMAL(15,2),
    "order_created_at" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "shipped_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "fulfillment_type" TEXT,
    "warehouse_name" TEXT,
    "payment_method" TEXT,
    "state" TEXT,
    "city" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" SERIAL NOT NULL,
    "order_id" TEXT NOT NULL,
    "sku_id" TEXT,
    "seller_sku" TEXT,
    "product_name" TEXT,
    "variation" TEXT,
    "quantity" INTEGER,
    "unit_original_price" DECIMAL(15,2),
    "subtotal_before_disc" DECIMAL(15,2),
    "platform_discount" DECIMAL(15,2),
    "seller_discount" DECIMAL(15,2),
    "subtotal_after_disc" DECIMAL(15,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "orders_order_id_key" ON "orders"("order_id");

-- CreateIndex
CREATE INDEX "orders_paid_at_idx" ON "orders"("paid_at");

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "orders"("status");

-- CreateIndex
CREATE INDEX "orders_order_channel_idx" ON "orders"("order_channel");

-- CreateIndex
CREATE INDEX "order_items_order_id_idx" ON "order_items"("order_id");

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("order_id") ON DELETE RESTRICT ON UPDATE CASCADE;
