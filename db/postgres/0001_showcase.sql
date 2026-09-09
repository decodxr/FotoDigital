-- Incremental equivalent of the second Drizzle migration; preserve existing records.
CREATE TABLE "storeMedia" (
    "id" text PRIMARY KEY NOT NULL,
    "objectKey" text NOT NULL,
    "mime" text NOT NULL,
    "bytes" integer NOT NULL,
    "createdAt" text NOT NULL
);
ALTER TABLE "banners" ADD COLUMN "sortOrder" integer DEFAULT 0 NOT NULL;
ALTER TABLE "banners" ADD COLUMN "illustrative" integer DEFAULT 0 NOT NULL;
CREATE INDEX "banners_active_order_idx" ON "banners" ("active", "sortOrder");
