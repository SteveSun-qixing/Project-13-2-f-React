DO $$ BEGIN
 CREATE TYPE "card_pipeline_job_status" AS ENUM('queued', 'processing', 'succeeded', 'failed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "card_pipeline_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"card_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"source_bucket" text NOT NULL,
	"source_key" text NOT NULL,
	"status" "card_pipeline_job_status" DEFAULT 'queued' NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"max_retries" integer DEFAULT 2 NOT NULL,
	"last_error" text,
	"locked_by" text,
	"locked_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT NOW() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT NOW() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN IF NOT EXISTS "cover_ratio" text;
--> statement-breakpoint
ALTER TABLE "boxes" ADD COLUMN IF NOT EXISTS "cover_ratio" text;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "card_pipeline_jobs" ADD CONSTRAINT "card_pipeline_jobs_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "card_pipeline_jobs" ADD CONSTRAINT "card_pipeline_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cards_user_visibility_status_created_at_idx" ON "cards" ("user_id","visibility","status","created_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cards_room_visibility_status_created_at_idx" ON "cards" ("room_id","visibility","status","created_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cards_visibility_status_created_at_idx" ON "cards" ("visibility","status","created_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cards_card_file_id_idx" ON "cards" ("card_file_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "boxes_user_visibility_created_at_idx" ON "boxes" ("user_id","visibility","created_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "boxes_room_visibility_created_at_idx" ON "boxes" ("room_id","visibility","created_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "boxes_visibility_created_at_idx" ON "boxes" ("visibility","created_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rooms_user_visibility_created_at_idx" ON "rooms" ("user_id","visibility","created_at" DESC);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "rooms_user_slug_unique_idx" ON "rooms" ("user_id","slug");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "card_pipeline_jobs_status_created_at_idx" ON "card_pipeline_jobs" ("status","created_at");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "card_pipeline_jobs_card_id_unique_idx" ON "card_pipeline_jobs" ("card_id");
