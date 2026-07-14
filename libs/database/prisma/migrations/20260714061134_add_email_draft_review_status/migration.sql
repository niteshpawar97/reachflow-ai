-- CreateEnum
CREATE TYPE "EmailDraftStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "email_drafts" ADD COLUMN     "reviewed_at" TIMESTAMPTZ(6),
ADD COLUMN     "status" "EmailDraftStatus" NOT NULL DEFAULT 'PENDING';
