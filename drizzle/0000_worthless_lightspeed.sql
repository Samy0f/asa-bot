CREATE TABLE "bookmarks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"guild_id" text NOT NULL,
	"name" text NOT NULL,
	"image_url" text NOT NULL,
	"r2_key" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_bookmarks_name" ON "bookmarks" USING btree ("name");