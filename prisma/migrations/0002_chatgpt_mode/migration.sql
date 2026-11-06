-- Flyers gerados no ChatGPT e criação em lote
ALTER TABLE "FlyerProject" ADD COLUMN "mode" TEXT NOT NULL DEFAULT 'editor';
ALTER TABLE "FlyerProject" ADD COLUMN "prompt" TEXT;
ALTER TABLE "FlyerProject" ADD COLUMN "resultFileId" TEXT;
ALTER TABLE "FlyerProject" ADD COLUMN "batchId" TEXT;
CREATE INDEX "FlyerProject_batchId_idx" ON "FlyerProject"("batchId");
