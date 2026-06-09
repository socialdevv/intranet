-- CreateEnum
CREATE TYPE "CommunicationKind" AS ENUM ('communication', 'organizational_topic');

-- DropIndex
DROP INDEX "project_comms_project_date_updated_idx";

-- DropIndex
DROP INDEX "project_comms_project_status_date_idx";

-- AlterTable
ALTER TABLE "project_communications" ADD COLUMN     "kind" "CommunicationKind" NOT NULL DEFAULT 'communication';

-- CreateIndex
CREATE INDEX "project_comms_project_kind_status_date_idx" ON "project_communications"("project_id", "kind", "status", "communication_date");

-- CreateIndex
CREATE INDEX "project_comms_project_kind_date_updated_idx" ON "project_communications"("project_id", "kind", "communication_date", "updated_at");
