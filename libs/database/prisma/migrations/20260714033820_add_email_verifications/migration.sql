-- CreateTable
CREATE TABLE "email_verifications" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "email_hash" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" "EmailStatus" NOT NULL DEFAULT 'UNKNOWN',
    "mx_ok" BOOLEAN NOT NULL DEFAULT false,
    "disposable" BOOLEAN NOT NULL DEFAULT false,
    "role_account" BOOLEAN NOT NULL DEFAULT false,
    "risk_score" INTEGER NOT NULL,
    "reason" TEXT,
    "checked_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "email_verifications_workspace_id_email_hash_key" ON "email_verifications"("workspace_id", "email_hash");

-- AddForeignKey
ALTER TABLE "email_verifications" ADD CONSTRAINT "email_verifications_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
