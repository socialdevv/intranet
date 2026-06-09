/*
  Warnings:

  - You are about to drop the `project_important_topics` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "project_important_topics" DROP CONSTRAINT "project_important_topics_project_id_fkey";

-- DropTable
DROP TABLE "project_important_topics";

-- DropEnum
DROP TYPE "ImportantTopicStatus";
