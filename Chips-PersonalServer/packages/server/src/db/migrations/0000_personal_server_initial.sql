CREATE TYPE "card_status" AS ENUM('pending', 'ready', 'error');
--> statement-breakpoint
CREATE TYPE "card_visibility" AS ENUM('public', 'private');
--> statement-breakpoint
CREATE TYPE "box_visibility" AS ENUM('public', 'private');
--> statement-breakpoint
CREATE TYPE "upload_session_content_type" AS ENUM('card', 'box');
--> statement-breakpoint
CREATE TYPE "upload_session_status" AS ENUM('created', 'uploading_resources', 'submitting_document', 'validating', 'source_ready', 'error', 'cancelled', 'expired');
--> statement-breakpoint
CREATE TYPE "upload_session_resource_status" AS ENUM('presigned', 'uploaded', 'verified', 'error');
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"card_file_id" varchar(10),
	"title" text NOT NULL,
	"cover_url" text,
	"cover_ratio" text,
	"html_url" text,
	"render_artifacts" jsonb,
	"rendered_at" timestamp with time zone,
	"source_card_bucket" text,
	"source_card_key" text,
	"source_card_url" text,
	"source_card_sha256" text,
	"source_card_stored_at" timestamp with time zone,
	"resource_manifest" jsonb,
	"published_by_client" text,
	"published_client_version" text,
	"published_at" timestamp with time zone,
	"card_metadata" jsonb,
	"card_structure" jsonb,
	"status" "card_status" DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"visibility" "card_visibility" DEFAULT 'public' NOT NULL,
	"file_size_bytes" bigint,
	"created_at" timestamp with time zone DEFAULT NOW() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT NOW() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "boxes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"box_file_id" varchar(10),
	"title" text NOT NULL,
	"cover_url" text,
	"cover_bucket" text,
	"cover_key" text,
	"cover_ratio" text,
	"document_url" text,
	"metadata" jsonb,
	"structure" jsonb,
	"content" jsonb,
	"layout_plugin" text,
	"source_box_bucket" text,
	"source_box_key" text,
	"source_box_url" text,
	"source_box_sha256" text,
	"source_box_stored_at" timestamp with time zone,
	"visibility" "box_visibility" DEFAULT 'public' NOT NULL,
	"file_size_bytes" bigint,
	"created_at" timestamp with time zone DEFAULT NOW() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT NOW() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "upload_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_type" "upload_session_content_type" NOT NULL,
	"status" "upload_session_status" DEFAULT 'created' NOT NULL,
	"visibility" "card_visibility" DEFAULT 'public' NOT NULL,
	"include_render_artifacts" boolean DEFAULT false NOT NULL,
	"file_name" text,
	"resource_prefix" text NOT NULL,
	"source_card_bucket" text,
	"source_card_key" text,
	"source_card_sha256" text,
	"source_box_bucket" text,
	"source_box_key" text,
	"source_box_sha256" text,
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
CREATE INDEX IF NOT EXISTS "cards_visibility_status_created_at_idx" ON "cards" USING btree ("visibility","status","created_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cards_card_file_id_idx" ON "cards" USING btree ("card_file_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cards_source_card_sha256_idx" ON "cards" USING btree ("source_card_sha256");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cards_source_card_object_idx" ON "cards" USING btree ("source_card_bucket","source_card_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "boxes_visibility_created_at_idx" ON "boxes" USING btree ("visibility","created_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "boxes_source_box_object_idx" ON "boxes" USING btree ("source_box_bucket","source_box_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "boxes_source_box_sha256_idx" ON "boxes" USING btree ("source_box_sha256");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "upload_sessions_status_created_at_idx" ON "upload_sessions" USING btree ("status","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "upload_sessions_expires_at_idx" ON "upload_sessions" USING btree ("expires_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "upload_sessions_resource_prefix_idx" ON "upload_sessions" USING btree ("resource_prefix");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "upload_sessions_idempotency_unique_idx" ON "upload_sessions" USING btree ("idempotency_key");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "upload_session_resources_session_relative_path_idx" ON "upload_session_resources" USING btree ("upload_session_id","relative_path");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "upload_session_resources_object_idx" ON "upload_session_resources" USING btree ("bucket","object_key");
--> statement-breakpoint
ALTER TABLE "upload_session_resources" ADD CONSTRAINT "upload_session_resources_upload_session_id_upload_sessions_id_fk" FOREIGN KEY ("upload_session_id") REFERENCES "upload_sessions"("id") ON DELETE cascade;
