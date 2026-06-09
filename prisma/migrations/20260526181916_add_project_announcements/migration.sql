-- CreateEnum
CREATE TYPE "AnnouncementColor" AS ENUM ('red', 'orange', 'green', 'blue');

-- CreateTable
CREATE TABLE "project_announcements" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "body_jsonb" JSONB,
    "description" TEXT NOT NULL DEFAULT '',
    "color" "AnnouncementColor" NOT NULL DEFAULT 'blue',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "visible_from" TIMESTAMPTZ(6),
    "visible_until" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "project_announcements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_announcements_project_id_sort_order_created_at_idx" ON "project_announcements"("project_id", "sort_order", "created_at");

-- CreateIndex
CREATE INDEX "project_announcements_project_id_active_visible_window_idx" ON "project_announcements"("project_id", "active", "visible_from", "visible_until");

-- AddForeignKey
ALTER TABLE "project_announcements" ADD CONSTRAINT "project_announcements_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
