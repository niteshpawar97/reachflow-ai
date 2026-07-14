-- CreateTable
CREATE TABLE "lead_scores" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "score" INTEGER NOT NULL,
    "fit_score" INTEGER NOT NULL,
    "intent_score" INTEGER NOT NULL,
    "confidence" INTEGER NOT NULL,
    "factors" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "lead_scores_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lead_scores_lead_id_key" ON "lead_scores"("lead_id");

-- CreateIndex
CREATE INDEX "lead_scores_workspace_id_score_idx" ON "lead_scores"("workspace_id", "score");

-- AddForeignKey
ALTER TABLE "lead_scores" ADD CONSTRAINT "lead_scores_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_scores" ADD CONSTRAINT "lead_scores_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
