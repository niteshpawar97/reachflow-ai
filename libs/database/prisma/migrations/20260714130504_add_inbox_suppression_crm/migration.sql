-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "ReplyClassification" AS ENUM ('UNCLASSIFIED', 'INTERESTED', 'NOT_INTERESTED', 'MEETING_REQUEST', 'PRICING_QUESTION', 'REFERRAL', 'OUT_OF_OFFICE', 'UNSUBSCRIBE_REQUEST', 'BOUNCE', 'SPAM', 'OTHER');

-- CreateEnum
CREATE TYPE "SuppressionReason" AS ENUM ('UNSUBSCRIBED', 'BOUNCED', 'COMPLAINED', 'MANUAL');

-- CreateEnum
CREATE TYPE "DealStage" AS ENUM ('NEW', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "DealActivityType" AS ENUM ('EMAIL', 'REPLY', 'CALL', 'NOTE', 'MEETING', 'STAGE_CHANGE');

-- AlterTable
ALTER TABLE "mailboxes" ADD COLUMN     "imap_host" TEXT,
ADD COLUMN     "imap_last_sync_at" TIMESTAMPTZ(6),
ADD COLUMN     "imap_last_uid" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "imap_port" INTEGER,
ADD COLUMN     "imap_secure" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "imap_username" TEXT;

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "mailbox_id" UUID NOT NULL,
    "campaign_lead_id" UUID,
    "direction" "MessageDirection" NOT NULL DEFAULT 'INBOUND',
    "from_address" TEXT NOT NULL,
    "to_address" TEXT NOT NULL,
    "subject" TEXT,
    "snippet" TEXT,
    "body_text" TEXT,
    "message_id_header" TEXT,
    "in_reply_to" TEXT,
    "imap_uid" INTEGER,
    "received_at" TIMESTAMPTZ(6) NOT NULL,
    "classification" "ReplyClassification" NOT NULL DEFAULT 'UNCLASSIFIED',
    "classification_confidence" INTEGER,
    "classification_summary" TEXT,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppressions" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "reason" "SuppressionReason" NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "suppressions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deals" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "stage" "DealStage" NOT NULL DEFAULT 'NEW',
    "value" DECIMAL(12,2),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "closed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "deals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal_activities" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "deal_id" UUID NOT NULL,
    "type" "DealActivityType" NOT NULL,
    "body" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deal_activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "messages_workspace_id_campaign_lead_id_idx" ON "messages"("workspace_id", "campaign_lead_id");

-- CreateIndex
CREATE INDEX "messages_workspace_id_direction_received_at_idx" ON "messages"("workspace_id", "direction", "received_at");

-- CreateIndex
CREATE UNIQUE INDEX "messages_mailbox_id_imap_uid_key" ON "messages"("mailbox_id", "imap_uid");

-- CreateIndex
CREATE UNIQUE INDEX "suppressions_workspace_id_email_key" ON "suppressions"("workspace_id", "email");

-- CreateIndex
CREATE INDEX "deals_workspace_id_stage_idx" ON "deals"("workspace_id", "stage");

-- CreateIndex
CREATE INDEX "deal_activities_workspace_id_deal_id_idx" ON "deal_activities"("workspace_id", "deal_id");

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_mailbox_id_fkey" FOREIGN KEY ("mailbox_id") REFERENCES "mailboxes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_campaign_lead_id_fkey" FOREIGN KEY ("campaign_lead_id") REFERENCES "campaign_leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppressions" ADD CONSTRAINT "suppressions_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_activities" ADD CONSTRAINT "deal_activities_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_activities" ADD CONSTRAINT "deal_activities_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
