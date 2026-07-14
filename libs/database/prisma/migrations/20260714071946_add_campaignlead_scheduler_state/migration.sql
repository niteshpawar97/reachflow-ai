/*
  Warnings:

  - A unique constraint covering the columns `[queued_job_key]` on the table `campaign_leads` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "campaign_leads" ADD COLUMN     "queued_at" TIMESTAMPTZ(6),
ADD COLUMN     "queued_job_key" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "campaign_leads_queued_job_key_key" ON "campaign_leads"("queued_job_key");
