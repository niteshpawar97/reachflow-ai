-- CreateEnum
CREATE TYPE "AuditStatus" AS ENUM ('OK', 'PARTIAL', 'FAILED');

-- CreateTable
CREATE TABLE "website_audits" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "status" "AuditStatus" NOT NULL DEFAULT 'OK',
    "https" BOOLEAN NOT NULL DEFAULT false,
    "ssl_valid" BOOLEAN NOT NULL DEFAULT false,
    "status_code" INTEGER,
    "response_time_ms" INTEGER,
    "title" TEXT,
    "meta_description" TEXT,
    "h1_count" INTEGER,
    "mobile_friendly" BOOLEAN NOT NULL DEFAULT false,
    "has_contact_form" BOOLEAN NOT NULL DEFAULT false,
    "has_cta" BOOLEAN NOT NULL DEFAULT false,
    "cms" TEXT,
    "tech_stack" JSONB,
    "findings" JSONB,
    "performance_score" INTEGER,
    "ai_summary" TEXT,
    "error" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "website_audits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "website_audits_workspace_id_company_id_idx" ON "website_audits"("workspace_id", "company_id");

-- AddForeignKey
ALTER TABLE "website_audits" ADD CONSTRAINT "website_audits_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "website_audits" ADD CONSTRAINT "website_audits_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
