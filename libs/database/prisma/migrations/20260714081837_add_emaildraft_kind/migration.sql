-- CreateEnum
CREATE TYPE "EmailDraftKind" AS ENUM ('INITIAL', 'FOLLOWUP', 'VARIANT');

-- AlterTable
ALTER TABLE "email_drafts" ADD COLUMN     "kind" "EmailDraftKind" NOT NULL DEFAULT 'INITIAL',
ADD COLUMN     "sequence_index" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "variant_label" TEXT;
