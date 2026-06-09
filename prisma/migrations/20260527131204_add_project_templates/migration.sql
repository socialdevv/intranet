-- CreateEnum
CREATE TYPE "TemplateChannel" AS ENUM ('email', 'zgloszenie');

-- AlterEnum
ALTER TYPE "ModuleKey" ADD VALUE 'templates';

-- CreateTable
CREATE TABLE "project_templates" (
    "id" VARCHAR(191) NOT NULL,
    "project_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "channel" "TemplateChannel" NOT NULL,
    "body_jsonb" JSONB,
    "example_jsonb" JSONB,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "project_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_templates_project_id_channel_sort_order_idx" ON "project_templates"("project_id", "channel", "sort_order");

-- CreateIndex
CREATE INDEX "project_templates_project_id_sort_order_title_idx" ON "project_templates"("project_id", "sort_order", "title");

-- AddForeignKey
ALTER TABLE "project_templates" ADD CONSTRAINT "project_templates_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
