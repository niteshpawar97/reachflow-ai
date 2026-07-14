-- CreateEnum
CREATE TYPE "MailboxProvider" AS ENUM ('SMTP', 'GMAIL', 'M365');

-- CreateEnum
CREATE TYPE "MailboxStatus" AS ENUM ('ACTIVE', 'DISCONNECTED', 'ERROR', 'PAUSED');

-- CreateTable
CREATE TABLE "mailboxes" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "provider" "MailboxProvider" NOT NULL DEFAULT 'SMTP',
    "email" TEXT NOT NULL,
    "display_name" TEXT,
    "status" "MailboxStatus" NOT NULL DEFAULT 'ACTIVE',
    "smtp_host" TEXT,
    "smtp_port" INTEGER,
    "smtp_secure" BOOLEAN NOT NULL DEFAULT true,
    "smtp_username" TEXT,
    "secret_ciphertext" TEXT,
    "daily_limit" INTEGER NOT NULL DEFAULT 50,
    "sent_today" INTEGER NOT NULL DEFAULT 0,
    "warmup_enabled" BOOLEAN NOT NULL DEFAULT false,
    "last_error" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "mailboxes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mailboxes_workspace_id_status_idx" ON "mailboxes"("workspace_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "mailboxes_workspace_id_email_key" ON "mailboxes"("workspace_id", "email");

-- AddForeignKey
ALTER TABLE "mailboxes" ADD CONSTRAINT "mailboxes_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
