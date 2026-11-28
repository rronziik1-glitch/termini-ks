-- v7: unclaimed listings, demand requests, automatic messages, review feedback, money book.
ALTER TABLE "Business" ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Business" ADD COLUMN "autoReminders" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Business" ADD COLUMN "winbackOn" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Business" ADD COLUMN "reviewAskOn" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Business" ADD COLUMN "googleReviewUrl" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Business" ADD COLUMN "listingId" TEXT;

ALTER TABLE "Customer" ADD COLUMN "marketingOk" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Customer" ADD COLUMN "winbackSentAt" TIMESTAMP(3);

ALTER TABLE "Booking" ADD COLUMN "reminder24At" TIMESTAMP(3);
ALTER TABLE "Booking" ADD COLUMN "reviewAskedAt" TIMESTAMP(3);
ALTER TABLE "Booking" ADD COLUMN "fromWinback" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Booking" ADD COLUMN "paidMethod" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "Listing" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "address" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "sourceId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "claimedBusinessId" TEXT,
    "claimRequestPhone" TEXT NOT NULL DEFAULT '',
    "requestsCount" INTEGER NOT NULL DEFAULT 0,
    "lastRequestAt" TIMESTAMP(3),
    "contactedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListingRequest" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "ipHash" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListingRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageLog" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "customerId" TEXT,
    "bookingId" TEXT,
    "kind" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'link',
    "status" TEXT NOT NULL DEFAULT 'queued',
    "text" TEXT NOT NULL DEFAULT '',
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessageLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'tjeter',
    "note" TEXT NOT NULL DEFAULT '',
    "receiptKey" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Listing_slug_key" ON "Listing"("slug");
CREATE UNIQUE INDEX "Listing_sourceId_key" ON "Listing"("sourceId");
CREATE INDEX "Listing_status_city_category_idx" ON "Listing"("status", "city", "category");
CREATE INDEX "ListingRequest_listingId_createdAt_idx" ON "ListingRequest"("listingId", "createdAt");
CREATE INDEX "MessageLog_businessId_status_createdAt_idx" ON "MessageLog"("businessId", "status", "createdAt");
CREATE UNIQUE INDEX "Feedback_bookingId_key" ON "Feedback"("bookingId");
CREATE INDEX "Feedback_businessId_createdAt_idx" ON "Feedback"("businessId", "createdAt");
CREATE INDEX "Expense_businessId_date_idx" ON "Expense"("businessId", "date");

-- AddForeignKey
ALTER TABLE "ListingRequest" ADD CONSTRAINT "ListingRequest_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
