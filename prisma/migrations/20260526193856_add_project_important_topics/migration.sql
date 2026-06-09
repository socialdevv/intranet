-- CreateEnum
CREATE TYPE "ImportantTopicStatus" AS ENUM ('active', 'archived');

-- CreateTable
CREATE TABLE "project_important_topics" (
    "id" VARCHAR(191) NOT NULL,
    "project_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "body_jsonb" JSONB,
    "status" "ImportantTopicStatus" NOT NULL DEFAULT 'active',
    "entry_date" DATE,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "project_important_topics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_important_topics_project_id_status_entry_date_idx" ON "project_important_topics"("project_id", "status", "entry_date");

-- CreateIndex
CREATE INDEX "project_important_topics_project_id_entry_date_updated_at_idx" ON "project_important_topics"("project_id", "entry_date", "updated_at");

-- AddForeignKey
ALTER TABLE "project_important_topics" ADD CONSTRAINT "project_important_topics_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
