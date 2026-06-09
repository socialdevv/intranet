-- CreateEnum
CREATE TYPE "CommunicationStatus" AS ENUM ('active', 'archived');

-- AlterEnum
ALTER TYPE "ModuleKey" ADD VALUE 'communications';

-- CreateTable
CREATE TABLE "project_communications" (
    "id" VARCHAR(191) NOT NULL,
    "project_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "body_jsonb" JSONB,
    "status" "CommunicationStatus" NOT NULL DEFAULT 'active',
    "communication_date" DATE,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "project_communications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_comms_project_status_date_idx" ON "project_communications"("project_id", "status", "communication_date");

-- CreateIndex
CREATE INDEX "project_comms_project_date_updated_idx" ON "project_communications"("project_id", "communication_date", "updated_at");

-- AddForeignKey
ALTER TABLE "project_communications" ADD CONSTRAINT "project_communications_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
