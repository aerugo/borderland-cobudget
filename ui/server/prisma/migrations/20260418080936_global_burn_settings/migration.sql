-- AlterTable
ALTER TABLE "Collection" ADD COLUMN     "globalBurnApiKey" TEXT,
ADD COLUMN     "globalBurnEventId" TEXT,
ADD COLUMN     "globalBurnInstanceUrl" TEXT,
ADD COLUMN     "globalBurnVerified" BOOLEAN DEFAULT false;
