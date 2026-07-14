-- AlterTable
ALTER TABLE "mailboxes" ADD COLUMN     "auto_paused_at" TIMESTAMP(3),
ADD COLUMN     "bounce_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "domain_auth_checked_at" TIMESTAMPTZ(6),
ADD COLUMN     "domain_auth_report" JSONB,
ADD COLUMN     "health_score" INTEGER NOT NULL DEFAULT 100,
ADD COLUMN     "sent_total" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "warmup_day" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "warmup_started_at" TIMESTAMP(3);
