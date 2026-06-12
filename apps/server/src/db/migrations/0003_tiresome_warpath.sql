CREATE TYPE "public"."channel" AS ENUM('development', 'staging', 'production');--> statement-breakpoint
CREATE TABLE "screen_channels" (
	"screen_id" text NOT NULL,
	"channel" "channel" NOT NULL,
	"active_publication_id" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "publications" ADD COLUMN "channel" "channel" DEFAULT 'production' NOT NULL;--> statement-breakpoint
ALTER TABLE "screen_channels" ADD CONSTRAINT "screen_channels_screen_id_screens_id_fk" FOREIGN KEY ("screen_id") REFERENCES "public"."screens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "screen_channels_pk" ON "screen_channels" USING btree ("screen_id","channel");--> statement-breakpoint
-- Migrate pre-channel state: a screen's active publication becomes its production channel entry
INSERT INTO "screen_channels" ("screen_id", "channel", "active_publication_id", "updated_at")
SELECT "id", 'production', "active_publication_id", now()
FROM "screens"
WHERE "active_publication_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "screens" DROP COLUMN "active_publication_id";