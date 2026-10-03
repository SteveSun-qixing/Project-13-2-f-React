CREATE TYPE "public"."card_status" AS ENUM('pending', 'ready', 'error');--> statement-breakpoint
CREATE TYPE "public"."card_visibility" AS ENUM('public', 'private');--> statement-breakpoint
CREATE TYPE "public"."box_visibility" AS ENUM('public', 'private');--> statement-breakpoint
CREATE TABLE "cards" (
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
CREATE TABLE "boxes" (
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
CREATE INDEX "cards_visibility_status_created_at_idx" ON "cards" USING btree ("visibility","status","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "cards_card_file_id_idx" ON "cards" USING btree ("card_file_id");--> statement-breakpoint
CREATE INDEX "cards_source_card_sha256_idx" ON "cards" USING btree ("source_card_sha256");--> statement-breakpoint
CREATE INDEX "cards_source_card_object_idx" ON "cards" USING btree ("source_card_bucket","source_card_key");--> statement-breakpoint
CREATE INDEX "boxes_visibility_created_at_idx" ON "boxes" USING btree ("visibility","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "boxes_source_box_object_idx" ON "boxes" USING btree ("source_box_bucket","source_box_key");--> statement-breakpoint
CREATE INDEX "boxes_source_box_sha256_idx" ON "boxes" USING btree ("source_box_sha256");