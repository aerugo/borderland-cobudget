-- CreateTable
CREATE TABLE "freud_overrides" (
    "id" TEXT NOT NULL,
    "collection_id" TEXT NOT NULL,
    "bucket_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "manual_amount" INTEGER,
    "updated_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "freud_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "freud_overrides_collection_id_bucket_id_key" ON "freud_overrides"("collection_id", "bucket_id");

-- AddForeignKey
ALTER TABLE "freud_overrides" ADD CONSTRAINT "freud_overrides_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "Collection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "freud_overrides" ADD CONSTRAINT "freud_overrides_bucket_id_fkey" FOREIGN KEY ("bucket_id") REFERENCES "Bucket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "freud_overrides" ADD CONSTRAINT "freud_overrides_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "CollectionMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
