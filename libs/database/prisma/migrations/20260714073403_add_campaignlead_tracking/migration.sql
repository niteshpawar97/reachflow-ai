/*
  Warnings:

  - A unique constraint covering the columns `[tracking_token]` on the table `campaign_leads` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "campaign_leads" ADD COLUMN     "click_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "clicked_at" TIMESTAMPTZ(6),
ADD COLUMN     "open_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "opened_at" TIMESTAMPTZ(6),
ADD COLUMN     "tracking_token" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "campaign_leads_tracking_token_key" ON "campaign_leads"("tracking_token");

-- CreateIndex
CREATE INDEX "campaign_leads_workspace_id_tracking_token_idx" ON "campaign_leads"("workspace_id", "tracking_token");
