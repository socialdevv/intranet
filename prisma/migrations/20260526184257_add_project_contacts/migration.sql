-- CreateEnum
CREATE TYPE "ContactGroup" AS ENUM ('wewnetrzne', 'zewnetrzne');

-- CreateTable
CREATE TABLE "project_contacts" (
    "id" VARCHAR(191) NOT NULL,
    "project_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "phone" VARCHAR(64),
    "email" VARCHAR(320),
    "address" TEXT,
    "detail_table_jsonb" JSONB,
    "group" "ContactGroup" NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "project_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_contacts_project_id_sort_order_title_idx" ON "project_contacts"("project_id", "sort_order", "title");

-- CreateIndex
CREATE INDEX "project_contacts_project_id_group_sort_order_idx" ON "project_contacts"("project_id", "group", "sort_order");

-- AddForeignKey
ALTER TABLE "project_contacts" ADD CONSTRAINT "project_contacts_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
