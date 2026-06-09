-- CreateTable
CREATE TABLE "project_knowledge_categories" (
    "id" VARCHAR(191) NOT NULL,
    "project_id" UUID NOT NULL,
    "slug" VARCHAR(191) NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "parent_id" VARCHAR(191),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "child_order" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "project_knowledge_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_knowledge_articles" (
    "id" VARCHAR(191) NOT NULL,
    "project_id" UUID NOT NULL,
    "category_id" VARCHAR(191) NOT NULL,
    "slug" VARCHAR(191) NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "author_name" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "hidden_tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "matrix_link_id" VARCHAR(191),
    "global_matrix_link_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "key_data_points_jsonb" JSONB,
    "quick_actions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "external_source_url" TEXT,
    "section_search_enabled" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "project_knowledge_articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_knowledge_article_sections" (
    "id" VARCHAR(191) NOT NULL,
    "article_id" VARCHAR(191) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "collapsible" BOOLEAN NOT NULL DEFAULT false,
    "show_separator" BOOLEAN NOT NULL DEFAULT true,
    "body_jsonb" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "project_knowledge_article_sections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_knowledge_categories_project_parent_sort_idx" ON "project_knowledge_categories"("project_id", "parent_id", "sort_order");

-- CreateIndex
CREATE INDEX "project_knowledge_categories_project_sort_name_idx" ON "project_knowledge_categories"("project_id", "sort_order", "name");

-- CreateIndex
CREATE UNIQUE INDEX "project_knowledge_categories_project_id_slug_key" ON "project_knowledge_categories"("project_id", "slug");

-- CreateIndex
CREATE INDEX "project_knowledge_articles_project_category_sort_idx" ON "project_knowledge_articles"("project_id", "category_id", "sort_order");

-- CreateIndex
CREATE INDEX "project_knowledge_articles_project_updated_idx" ON "project_knowledge_articles"("project_id", "updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "project_knowledge_articles_project_category_slug_key" ON "project_knowledge_articles"("project_id", "category_id", "slug");

-- CreateIndex
CREATE INDEX "project_knowledge_article_sections_article_sort_idx" ON "project_knowledge_article_sections"("article_id", "sort_order");

-- AddForeignKey
ALTER TABLE "project_knowledge_categories" ADD CONSTRAINT "project_knowledge_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "project_knowledge_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_knowledge_categories" ADD CONSTRAINT "project_knowledge_categories_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_knowledge_articles" ADD CONSTRAINT "project_knowledge_articles_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "project_knowledge_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_knowledge_articles" ADD CONSTRAINT "project_knowledge_articles_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_knowledge_article_sections" ADD CONSTRAINT "project_knowledge_article_sections_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "project_knowledge_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
