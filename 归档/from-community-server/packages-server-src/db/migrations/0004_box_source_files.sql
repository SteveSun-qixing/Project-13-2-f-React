ALTER TABLE "boxes" ADD COLUMN IF NOT EXISTS "content" jsonb;
--> statement-breakpoint
ALTER TABLE "boxes" ADD COLUMN IF NOT EXISTS "source_box_bucket" text;
--> statement-breakpoint
ALTER TABLE "boxes" ADD COLUMN IF NOT EXISTS "source_box_key" text;
--> statement-breakpoint
ALTER TABLE "boxes" ADD COLUMN IF NOT EXISTS "source_box_url" text;
--> statement-breakpoint
ALTER TABLE "boxes" ADD COLUMN IF NOT EXISTS "source_box_sha256" text;
--> statement-breakpoint
ALTER TABLE "boxes" ADD COLUMN IF NOT EXISTS "source_box_stored_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "upload_sessions" ADD COLUMN IF NOT EXISTS "source_box_bucket" text;
--> statement-breakpoint
ALTER TABLE "upload_sessions" ADD COLUMN IF NOT EXISTS "source_box_key" text;
--> statement-breakpoint
ALTER TABLE "upload_sessions" ADD COLUMN IF NOT EXISTS "source_box_sha256" text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "boxes_source_box_object_idx" ON "boxes" ("source_box_bucket", "source_box_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "boxes_source_box_sha256_idx" ON "boxes" ("source_box_sha256");
