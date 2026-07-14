-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('MANUAL', 'IMPORT', 'GOOGLE_MAPS', 'WEBSITE', 'DIRECTORY');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'ENRICHING', 'SCORED', 'READY', 'IN_CAMPAIGN', 'REPLIED', 'WON', 'LOST', 'SUPPRESSED');

-- CreateEnum
CREATE TYPE "ContactRole" AS ENUM ('FOUNDER', 'CEO', 'OWNER', 'DIRECTOR', 'MARKETING', 'IT', 'OPERATIONS', 'OTHER');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('UNKNOWN', 'VALID', 'INVALID', 'RISKY', 'CATCH_ALL');

-- CreateTable
CREATE TABLE "companies" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "website" TEXT,
    "domain" TEXT,
    "industry" TEXT,
    "size_band" TEXT,
    "country" TEXT,
    "city" TEXT,
    "tech_stack" JSONB,
    "socials" JSONB,
    "revenue_band" TEXT,
    "raw" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" TEXT,
    "title" TEXT,
    "role_type" "ContactRole",
    "email" TEXT,
    "email_status" "EmailStatus" NOT NULL DEFAULT 'UNKNOWN',
    "linkedin_url" TEXT,
    "confidence" INTEGER,
    "raw" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "contact_id" UUID,
    "source" "LeadSource" NOT NULL DEFAULT 'MANUAL',
    "source_key" TEXT,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "companies_workspace_id_domain_idx" ON "companies"("workspace_id", "domain");

-- CreateIndex
CREATE INDEX "companies_workspace_id_deleted_at_idx" ON "companies"("workspace_id", "deleted_at");

-- CreateIndex
CREATE INDEX "contacts_workspace_id_company_id_idx" ON "contacts"("workspace_id", "company_id");

-- CreateIndex
CREATE INDEX "contacts_workspace_id_email_idx" ON "contacts"("workspace_id", "email");

-- CreateIndex
CREATE INDEX "leads_workspace_id_status_idx" ON "leads"("workspace_id", "status");

-- CreateIndex
CREATE INDEX "leads_workspace_id_deleted_at_idx" ON "leads"("workspace_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "leads_workspace_id_source_source_key_key" ON "leads"("workspace_id", "source", "source_key");

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
