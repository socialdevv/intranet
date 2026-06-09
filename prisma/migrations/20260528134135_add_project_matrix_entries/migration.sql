-- CreateTable
CREATE TABLE "project_matrix_entries" (
    "id" VARCHAR(191) NOT NULL,
    "project_id" UUID NOT NULL,
    "category" TEXT NOT NULL,
    "subcategory" TEXT NOT NULL,
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "description" TEXT NOT NULL DEFAULT '',
    "sla_days" INTEGER NOT NULL DEFAULT 1,
    "instructions" TEXT NOT NULL DEFAULT '',
    "additional_notes" TEXT NOT NULL DEFAULT '',
    "default_department" TEXT NOT NULL DEFAULT '',
    "conditions_jsonb" JSONB NOT NULL,
    "linked_template_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "project_matrix_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_matrix_entries_project_category_sort_idx" ON "project_matrix_entries"("project_id", "category", "sort_order");

-- CreateIndex
CREATE INDEX "project_matrix_entries_project_subcategory_updated_idx" ON "project_matrix_entries"("project_id", "subcategory", "updated_at");

-- AddForeignKey
ALTER TABLE "project_matrix_entries" ADD CONSTRAINT "project_matrix_entries_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
