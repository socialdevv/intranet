-- CreateTable
CREATE TABLE "project_quick_links" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "icon" VARCHAR(64) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "open_in_new_tab" BOOLEAN NOT NULL DEFAULT true,
    "is_internal" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "project_quick_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_quick_links_project_id_sort_order_label_idx" ON "project_quick_links"("project_id", "sort_order", "label");

-- AddForeignKey
ALTER TABLE "project_quick_links" ADD CONSTRAINT "project_quick_links_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
