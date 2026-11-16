-- v6 (roles): business "approve every booking" switch, super-admin suspension, pending hold time, audit log index.
ALTER TABLE "Business" ADD COLUMN "requireApproval" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Business" ADD COLUMN "suspendedAt" TIMESTAMP(3);
ALTER TABLE "Business" ADD COLUMN "suspendedReason" TEXT NOT NULL DEFAULT '';

ALTER TABLE "Booking" ADD COLUMN "pendingUntil" TIMESTAMP(3);

CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
