-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "deliveryLat" DOUBLE PRECISION NOT NULL,
    "deliveryLng" DOUBLE PRECISION NOT NULL,
    "deliveryAddress" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "canceledAt" TIMESTAMP(3),

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" TEXT NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MerchantTask" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "merchantLat" DOUBLE PRECISION NOT NULL,
    "merchantLng" DOUBLE PRECISION NOT NULL,
    "taskStatus" TEXT NOT NULL,
    "attemptCount" INTEGER NOT NULL,
    "deadlineAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MerchantTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorReport" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "availability" TEXT NOT NULL,
    "etaReadyAt" TIMESTAMP(3) NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL,
    "reportedAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,

    CONSTRAINT "VendorReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoutePlan" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "stops" JSONB NOT NULL,
    "estimatedCompletionAt" TIMESTAMP(3) NOT NULL,
    "objectiveScore" DOUBLE PRECISION NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoutePlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DispatchInstruction" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "routeVersion" INTEGER NOT NULL,
    "nextStop" JSONB,
    "pickupNotes" TEXT NOT NULL,
    "etaToNextStopMinutes" INTEGER NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DispatchInstruction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpsTicket" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "OpsTicket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "OrderItem_merchantId_idx" ON "OrderItem"("merchantId");

-- CreateIndex
CREATE INDEX "MerchantTask_orderId_idx" ON "MerchantTask"("orderId");

-- CreateIndex
CREATE INDEX "MerchantTask_merchantId_idx" ON "MerchantTask"("merchantId");

-- CreateIndex
CREATE INDEX "VendorReport_orderId_idx" ON "VendorReport"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "VendorReport_orderId_merchantId_key" ON "VendorReport"("orderId", "merchantId");

-- CreateIndex
CREATE INDEX "RoutePlan_orderId_idx" ON "RoutePlan"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "RoutePlan_orderId_version_key" ON "RoutePlan"("orderId", "version");

-- CreateIndex
CREATE INDEX "DispatchInstruction_orderId_issuedAt_idx" ON "DispatchInstruction"("orderId", "issuedAt");

-- CreateIndex
CREATE INDEX "OpsTicket_orderId_idx" ON "OpsTicket"("orderId");

-- CreateIndex
CREATE INDEX "OpsTicket_status_idx" ON "OpsTicket"("status");

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerchantTask" ADD CONSTRAINT "MerchantTask_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorReport" ADD CONSTRAINT "VendorReport_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutePlan" ADD CONSTRAINT "RoutePlan_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispatchInstruction" ADD CONSTRAINT "DispatchInstruction_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpsTicket" ADD CONSTRAINT "OpsTicket_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
