-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ModuleKey" ADD VALUE 'home_sections';
ALTER TYPE "ModuleKey" ADD VALUE 'lead';

-- CreateTable
CREATE TABLE "project_home_spotlights" (
    "id" VARCHAR(191) NOT NULL,
    "project_id" UUID NOT NULL,
    "article_id" VARCHAR(191) NOT NULL,
    "label_override" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "project_home_spotlights_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_home_spotlights_project_id_sort_order_idx" ON "project_home_spotlights"("project_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "project_home_spotlights_project_id_article_id_key" ON "project_home_spotlights"("project_id", "article_id");

-- AddForeignKey
ALTER TABLE "project_home_spotlights" ADD CONSTRAINT "project_home_spotlights_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "project_knowledge_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_home_spotlights" ADD CONSTRAINT "project_home_spotlights_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
