ALTER TABLE "boxes" ADD COLUMN IF NOT EXISTS "cover_bucket" text;
--> statement-breakpoint
ALTER TABLE "boxes" ADD COLUMN IF NOT EXISTS "cover_key" text;
