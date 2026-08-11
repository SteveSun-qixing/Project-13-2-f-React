DO $$ BEGIN
 CREATE TYPE "user_role" AS ENUM('user', 'admin');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "visibility" AS ENUM('public', 'private');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "card_status" AS ENUM('pending', 'processing', 'ready', 'error');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "card_visibility" AS ENUM('public', 'private');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "box_visibility" AS ENUM('public', 'private');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" varchar(32) NOT NULL,
	"username_lower" varchar(32) NOT NULL,
	"display_name" varchar(100),
	"password_hash" text NOT NULL,
	"bio" varchar(200),
	"avatar_url" text,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT NOW() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT NOW() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_username_lower_unique" UNIQUE("username_lower")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"description" varchar(500),
	"cover_url" text,
	"visibility" "visibility" DEFAULT 'public' NOT NULL,
	"created_at" timestamp with time zone DEFAULT NOW() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT NOW() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"card_file_id" varchar(10),
	"user_id" uuid NOT NULL,
	"room_id" uuid,
	"title" text NOT NULL,
	"cover_url" text,
	"html_url" text,
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
	"user_id" uuid NOT NULL,
	"room_id" uuid,
	"title" text NOT NULL,
	"cover_url" text,
	"document_url" text,
	"metadata" jsonb,
	"structure" jsonb,
	"layout_plugin" text,
	"visibility" "box_visibility" DEFAULT 'public' NOT NULL,
	"file_size_bytes" bigint,
	"created_at" timestamp with time zone DEFAULT NOW() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT NOW() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "boxes" ADD COLUMN IF NOT EXISTS "document_url" text;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rooms" ADD CONSTRAINT "rooms_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cards" ADD CONSTRAINT "cards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cards" ADD CONSTRAINT "cards_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "boxes" ADD CONSTRAINT "boxes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "boxes" ADD CONSTRAINT "boxes_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
