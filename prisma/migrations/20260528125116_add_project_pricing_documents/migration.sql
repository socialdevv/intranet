-- CreateEnum
CREATE TYPE "PricingStatus" AS ENUM ('active', 'archived');

-- AlterEnum
ALTER TYPE "ModuleKey" ADD VALUE 'pricing';

-- CreateTable
CREATE TABLE "project_pricing_documents" (
    "id" VARCHAR(191) NOT NULL,
    "project_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "provider" TEXT,
    "effective_from" DATE NOT NULL,
    "status" "PricingStatus" NOT NULL DEFAULT 'active',
    "footnotes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sections_jsonb" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "project_pricing_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_pricing_docs_project_effective_updated_idx" ON "project_pricing_documents"("project_id", "effective_from", "updated_at");

-- CreateIndex
CREATE INDEX "project_pricing_docs_project_status_effective_idx" ON "project_pricing_documents"("project_id", "status", "effective_from");

-- AddForeignKey
ALTER TABLE "project_pricing_documents" ADD CONSTRAINT "project_pricing_documents_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
