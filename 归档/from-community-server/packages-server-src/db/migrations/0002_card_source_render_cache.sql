ALTER TABLE "cards" ADD COLUMN IF NOT EXISTS "source_card_bucket" text;
--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN IF NOT EXISTS "source_card_key" text;
--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN IF NOT EXISTS "source_card_url" text;
--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN IF NOT EXISTS "source_card_sha256" text;
--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN IF NOT EXISTS "source_card_stored_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN IF NOT EXISTS "resource_manifest" jsonb;
--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN IF NOT EXISTS "published_by_client" text;
--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN IF NOT EXISTS "published_client_version" text;
--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN IF NOT EXISTS "published_at" timestamp with time zone;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "upload_session_content_type" AS ENUM('card', 'box');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "upload_session_status" AS ENUM('created', 'uploading_resources', 'submitting_document', 'validating', 'source_ready', 'error', 'cancelled', 'expired');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "upload_session_resource_status" AS ENUM('presigned', 'uploaded', 'verified', 'error');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "card_render_cache_status" AS ENUM('queued', 'rendering', 'ready', 'error', 'deleting', 'deleted');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "card_render_job_status" AS ENUM('queued', 'processing', 'succeeded', 'failed', 'cancelled');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "card_render_job_created_by" AS ENUM('upload', 'view_miss', 'cover_miss', 'manual', 'system_rebuild');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TYPE "card_render_job_created_by" ADD VALUE IF NOT EXISTS 'cover_miss';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "upload_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "content_type" "upload_session_content_type" NOT NULL,
  "status" "upload_session_status" DEFAULT 'created' NOT NULL,
  "room_id" uuid,
  "visibility" "card_visibility" DEFAULT 'public' NOT NULL,
  "file_name" text,
  "resource_prefix" text NOT NULL,
  "source_card_bucket" text,
  "source_card_key" text,
  "source_card_sha256" text,
  "idempotency_key" text,
  "error_code" text,
  "error_message" text,
  "client_name" text,
  "client_version" text,
  "client_platform" text,
  "client_metadata" jsonb,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT NOW() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT NOW() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "upload_session_resources" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "upload_session_id" uuid NOT NULL,
  "relative_path" text NOT NULL,
  "bucket" text NOT NULL,
  "object_key" text NOT NULL,
  "public_url" text NOT NULL,
  "size_bytes" bigint NOT NULL,
  "sha256" text NOT NULL,
  "mime_type" text NOT NULL,
  "status" "upload_session_resource_status" DEFAULT 'presigned' NOT NULL,
  "created_at" timestamp with time zone DEFAULT NOW() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT NOW() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "card_render_caches" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "card_id" uuid NOT NULL,
  "source_card_sha256" text NOT NULL,
  "renderer_version" text NOT NULL,
  "render_profile" text DEFAULT 'community-web' NOT NULL,
  "theme_id" text,
  "theme_version" text,
  "locale" text DEFAULT 'zh-CN' NOT NULL,
  "plugin_version_manifest" jsonb,
  "status" "card_render_cache_status" DEFAULT 'queued' NOT NULL,
  "cache_bucket" text NOT NULL,
  "cache_key_prefix" text NOT NULL,
  "entry_object_key" text NOT NULL,
  "entry_url" text NOT NULL,
  "cover_object_key" text,
  "cover_url" text,
  "render_manifest" jsonb,
  "size_bytes" bigint,
  "generated_at" timestamp with time zone,
  "last_accessed_at" timestamp with time zone,
  "expires_at" timestamp with time zone,
  "error_code" text,
  "error_message" text,
  "created_at" timestamp with time zone DEFAULT NOW() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT NOW() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "card_render_jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "card_id" uuid NOT NULL,
  "render_cache_id" uuid,
  "source_card_sha256" text NOT NULL,
  "renderer_version" text NOT NULL,
  "render_profile" text DEFAULT 'community-web' NOT NULL,
  "locale" text DEFAULT 'zh-CN' NOT NULL,
  "status" "card_render_job_status" DEFAULT 'queued' NOT NULL,
  "priority" integer DEFAULT 100 NOT NULL,
  "attempt_count" integer DEFAULT 0 NOT NULL,
  "max_attempts" integer DEFAULT 2 NOT NULL,
  "locked_by" text,
  "locked_at" timestamp with time zone,
  "run_after" timestamp with time zone DEFAULT NOW() NOT NULL,
  "last_error" text,
  "created_by" "card_render_job_created_by" DEFAULT 'upload' NOT NULL,
  "created_at" timestamp with time zone DEFAULT NOW() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT NOW() NOT NULL,
  "finished_at" timestamp with time zone
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "upload_sessions" ADD CONSTRAINT "upload_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "upload_sessions" ADD CONSTRAINT "upload_sessions_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "upload_session_resources" ADD CONSTRAINT "upload_session_resources_upload_session_id_upload_sessions_id_fk" FOREIGN KEY ("upload_session_id") REFERENCES "upload_sessions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "card_render_caches" ADD CONSTRAINT "card_render_caches_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "card_render_jobs" ADD CONSTRAINT "card_render_jobs_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "card_render_jobs" ADD CONSTRAINT "card_render_jobs_render_cache_id_card_render_caches_id_fk" FOREIGN KEY ("render_cache_id") REFERENCES "card_render_caches"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cards_source_card_sha256_idx" ON "cards" ("source_card_sha256");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cards_source_card_object_idx" ON "cards" ("source_card_bucket", "source_card_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "upload_sessions_user_status_created_at_idx" ON "upload_sessions" ("user_id", "status", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "upload_sessions_expires_at_idx" ON "upload_sessions" ("expires_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "upload_sessions_resource_prefix_idx" ON "upload_sessions" ("resource_prefix");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "upload_sessions_user_idempotency_unique_idx" ON "upload_sessions" ("user_id", "idempotency_key") WHERE "idempotency_key" IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "upload_session_resources_session_relative_path_idx" ON "upload_session_resources" ("upload_session_id", "relative_path");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "upload_session_resources_object_idx" ON "upload_session_resources" ("bucket", "object_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "card_render_caches_card_status_expires_at_idx" ON "card_render_caches" ("card_id", "status", "expires_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "card_render_caches_version_idx" ON "card_render_caches" ("card_id", "source_card_sha256", "renderer_version", "render_profile", "locale");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "card_render_caches_expires_at_idx" ON "card_render_caches" ("expires_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "card_render_caches_status_updated_at_idx" ON "card_render_caches" ("status", "updated_at");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "card_render_caches_cache_prefix_unique_idx" ON "card_render_caches" ("cache_bucket", "cache_key_prefix");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "card_render_jobs_status_priority_run_after_idx" ON "card_render_jobs" ("status", "priority", "run_after");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "card_render_jobs_version_idx" ON "card_render_jobs" ("card_id", "source_card_sha256", "renderer_version", "render_profile", "locale");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "card_render_jobs_locked_at_idx" ON "card_render_jobs" ("locked_at");
