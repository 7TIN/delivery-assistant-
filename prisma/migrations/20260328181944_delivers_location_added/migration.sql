-- CreateTable
CREATE TABLE "DriverLocation" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "driverLat" DOUBLE PRECISION NOT NULL,
    "driverLng" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriverLocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DriverLocation_orderId_key" ON "DriverLocation"("orderId");

-- CreateIndex
CREATE INDEX "DriverLocation_orderId_idx" ON "DriverLocation"("orderId");

-- AddForeignKey
ALTER TABLE "DriverLocation" ADD CONSTRAINT "DriverLocation_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
