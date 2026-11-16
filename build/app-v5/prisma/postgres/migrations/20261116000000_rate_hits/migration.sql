-- v4 (Fable audit): rate limits kept in the database, so they hold across all server instances.
-- CreateTable
CREATE TABLE "RateHit" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RateHit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RateHit_key_createdAt_idx" ON "RateHit"("key", "createdAt");

-- CreateIndex (bookings per IP in the last hour)
CREATE INDEX "Booking_createdIpHash_createdAt_idx" ON "Booking"("createdIpHash", "createdAt");
