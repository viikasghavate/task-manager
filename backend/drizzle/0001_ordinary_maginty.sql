ALTER TYPE "public"."task_status" ADD VALUE 'on_hold' BEFORE 'done';--> statement-breakpoint
CREATE TABLE "worknotes" (
	"id" serial PRIMARY KEY NOT NULL,
	"task_id" integer NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "worknotes" ADD CONSTRAINT "worknotes_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;