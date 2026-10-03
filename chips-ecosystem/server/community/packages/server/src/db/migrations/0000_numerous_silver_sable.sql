CREATE TYPE "public"."user_role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TYPE "public"."room_visibility" AS ENUM('public', 'private');--> statement-breakpoint
CREATE TYPE "public"."card_status" AS ENUM('pending', 'ready', 'error');--> statement-breakpoint
CREATE TYPE "public"."card_visibility" AS ENUM('public', 'private');--> statement-breakpoint
CREATE TYPE "public"."box_status" AS ENUM('pending', 'ready', 'error');--> statement-breakpoint
CREATE TYPE "public"."box_visibility" AS ENUM('public', 'private');--> statement-breakpoint
CREATE TYPE "public"."render_profile" AS ENUM('community-web', 'community-cover');--> statement-breakpoint
CREATE TYPE "public"."view_state" AS ENUM('pending', 'rendering', 'ready', 'error');--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" varchar(32) NOT NULL,
	"username_lower" varchar(32) NOT NULL,
	"email" varchar(254) NOT NULL,
	"password_hash" text NOT NULL,
	"display_name" varchar(100),
	"bio" varchar(200),
	"avatar_url" text,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"failed_login_count" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT NOW() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT NOW() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_username_lower_unique" UNIQUE("username_lower"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"description" varchar(500),
	"cover_url" text,
	"visibility" "room_visibility" DEFAULT 'public' NOT NULL,
	"created_at" timestamp with time zone DEFAULT NOW() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT NOW() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"card_file_id" varchar(10) DEFAULT '' NOT NULL,
	"user_id" uuid NOT NULL,
	"room_id" uuid,
	"name" text NOT NULL,
	"cover_ratio" varchar(20) DEFAULT '3:4' NOT NULL,
	"chip_standards_version" varchar(64) DEFAULT '' NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "card_status" DEFAULT 'pending' NOT NULL,
	"visibility" "card_visibility" DEFAULT 'public' NOT NULL,
	"error_message" text,
	"file_size_bytes" bigint DEFAULT 0 NOT NULL,
	"sha256" text DEFAULT '' NOT NULL,
	"source_bucket" text,
	"source_key" text,
	"source_card_sha256" text,
	"resource_manifest" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"artifact_objects" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT NOW() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT NOW() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "boxes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"box_file_id" varchar(10) DEFAULT '' NOT NULL,
	"user_id" uuid NOT NULL,
	"room_id" uuid,
	"name" text NOT NULL,
	"description" text,
	"cover_ratio" varchar(20) DEFAULT '3:4' NOT NULL,
	"active_layout_type" varchar(120) DEFAULT '' NOT NULL,
	"chip_standards_version" varchar(64) DEFAULT '' NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "box_status" DEFAULT 'pending' NOT NULL,
	"visibility" "box_visibility" DEFAULT 'public' NOT NULL,
	"error_message" text,
	"file_size_bytes" bigint DEFAULT 0 NOT NULL,
	"sha256" text DEFAULT '' NOT NULL,
	"cover_url" text,
	"cover_bucket" text,
	"cover_key" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"entries" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source_bucket" text,
	"source_key" text,
	"source_box_sha256" text,
	"created_at" timestamp with time zone DEFAULT NOW() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT NOW() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "card_render_caches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"card_id" uuid NOT NULL,
	"source_card_sha256" text NOT NULL,
	"renderer_version" text NOT NULL,
	"render_profile" "render_profile" NOT NULL,
	"state" "view_state" DEFAULT 'pending' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"cache_version" text DEFAULT '' NOT NULL,
	"cache_bucket" text,
	"cache_prefix" text,
	"view_entry_url" text,
	"cover_entry_url" text,
	"view_proxy_path" text,
	"cover_proxy_path" text,
	"error_code" text,
	"error_message" text,
	"last_accessed_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT NOW() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT NOW() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refresh_sessions" (
	"jti" varchar(64) PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT NOW() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "idempotency_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"endpoint" text NOT NULL,
	"idempotency_key" varchar(128) NOT NULL,
	"request_hash" text NOT NULL,
	"status_code" integer,
	"response_body" jsonb,
	"created_at" timestamp with time zone DEFAULT NOW() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "boxes" ADD CONSTRAINT "boxes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "boxes" ADD CONSTRAINT "boxes_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_render_caches" ADD CONSTRAINT "card_render_caches_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_sessions" ADD CONSTRAINT "refresh_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idempotency_records" ADD CONSTRAINT "idempotency_records_account_id_users_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rooms_user_visibility_created_at_idx" ON "rooms" USING btree ("user_id","visibility","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "rooms_user_slug_unique_idx" ON "rooms" USING btree ("user_id","slug");--> statement-breakpoint
CREATE INDEX "cards_visibility_status_created_at_idx" ON "cards" USING btree ("visibility","status","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "cards_user_created_at_idx" ON "cards" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "cards_room_created_at_idx" ON "cards" USING btree ("room_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "cards_card_file_id_idx" ON "cards" USING btree ("card_file_id");--> statement-breakpoint
CREATE INDEX "boxes_visibility_status_created_at_idx" ON "boxes" USING btree ("visibility","status","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "boxes_user_created_at_idx" ON "boxes" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "boxes_room_created_at_idx" ON "boxes" USING btree ("room_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "card_render_caches_key_unique_idx" ON "card_render_caches" USING btree ("card_id","source_card_sha256","renderer_version","render_profile");--> statement-breakpoint
CREATE INDEX "card_render_caches_card_idx" ON "card_render_caches" USING btree ("card_id");--> statement-breakpoint
CREATE INDEX "refresh_sessions_user_idx" ON "refresh_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idempotency_records_unique_idx" ON "idempotency_records" USING btree ("account_id","endpoint","idempotency_key");--> statement-breakpoint
CREATE INDEX "idempotency_records_expires_idx" ON "idempotency_records" USING btree ("expires_at");