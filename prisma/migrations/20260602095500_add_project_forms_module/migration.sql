DO $$
BEGIN
  ALTER TYPE "ModuleKey" ADD VALUE 'forms';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE "project_forms" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "slug" VARCHAR(191) NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "fields_jsonb" JSONB NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "project_forms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_form_submissions" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "form_id" UUID NOT NULL,
    "payload_jsonb" JSONB NOT NULL,
    "submitter_user_id" UUID,
    "submitter_email" VARCHAR(320),
    "submitter_first_name" TEXT,
    "submitter_last_name" TEXT,
    "submitter_display_name" TEXT,
    "delivery_status" VARCHAR(64) NOT NULL DEFAULT 'not_configured',
    "delivery_note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_form_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "project_forms_project_id_slug_key" ON "project_forms"("project_id", "slug");

-- CreateIndex
CREATE INDEX "project_forms_project_id_sort_order_title_idx" ON "project_forms"("project_id", "sort_order", "title");

-- CreateIndex
CREATE INDEX "project_form_submissions_project_id_form_id_created_at_idx" ON "project_form_submissions"("project_id", "form_id", "created_at");

-- CreateIndex
CREATE INDEX "project_form_submissions_project_id_created_at_idx" ON "project_form_submissions"("project_id", "created_at");

-- AddForeignKey
ALTER TABLE "project_forms" ADD CONSTRAINT "project_forms_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_form_submissions" ADD CONSTRAINT "project_form_submissions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_form_submissions" ADD CONSTRAINT "project_form_submissions_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "project_forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_form_submissions" ADD CONSTRAINT "project_form_submissions_submitter_user_id_fkey" FOREIGN KEY ("submitter_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
