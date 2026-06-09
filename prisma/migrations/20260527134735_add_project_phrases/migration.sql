-- AlterEnum
ALTER TYPE "ModuleKey" ADD VALUE 'phrases';

-- CreateTable
CREATE TABLE "project_phrases" (
    "id" VARCHAR(191) NOT NULL,
    "project_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "requires_confirmation" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "project_phrases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_phrases_project_id_sort_order_title_idx" ON "project_phrases"("project_id", "sort_order", "title");

-- AddForeignKey
ALTER TABLE "project_phrases" ADD CONSTRAINT "project_phrases_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
