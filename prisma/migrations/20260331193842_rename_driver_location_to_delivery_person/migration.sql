/*
  Warnings:

  - You are about to drop the `DriverLocation` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "DriverLocation" DROP CONSTRAINT "DriverLocation_orderId_fkey";

-- DropTable
DROP TABLE "DriverLocation";

-- CreateTable
CREATE TABLE "DeliveryPerson" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "driverLat" DOUBLE PRECISION NOT NULL,
    "driverLng" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryPerson_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryPerson_orderId_key" ON "DeliveryPerson"("orderId");

-- CreateIndex
CREATE INDEX "DeliveryPerson_orderId_idx" ON "DeliveryPerson"("orderId");

-- AddForeignKey
ALTER TABLE "DeliveryPerson" ADD CONSTRAINT "DeliveryPerson_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
