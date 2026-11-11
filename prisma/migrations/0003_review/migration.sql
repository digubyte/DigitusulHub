-- Aprovação dos flyers do lote (aprovar / refazer / pedir alterações)
ALTER TABLE "FlyerProject" ADD COLUMN "chatUrl" TEXT;
ALTER TABLE "FlyerProject" ADD COLUMN "reviewStatus" TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE "FlyerProject" ADD COLUMN "reviewNote" TEXT;
ALTER TABLE "FlyerProject" ADD COLUMN "reviewedAt" TIMESTAMP(3);
