-- CreateTable
CREATE TABLE "RoundResultsSnapshot" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoundResultsSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RoundResultsSnapshot_collectionId_key" ON "RoundResultsSnapshot"("collectionId");

-- CreateIndex
CREATE INDEX "RoundResultsSnapshot_computedAt_idx" ON "RoundResultsSnapshot"("computedAt");

-- AddForeignKey
ALTER TABLE "RoundResultsSnapshot" ADD CONSTRAINT "RoundResultsSnapshot_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
