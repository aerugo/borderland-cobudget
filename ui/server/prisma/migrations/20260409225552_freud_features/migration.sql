-- AlterTable
ALTER TABLE "Collection" ADD COLUMN     "freud_total_budget" INTEGER;

-- CreateTable
CREATE TABLE "dream_review_tags" (
    "id" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6B7280',
    "collection_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dream_review_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dream_reviews" (
    "id" TEXT NOT NULL,
    "bucket_id" TEXT NOT NULL,
    "reviewer_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dream_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dream_review_comments" (
    "id" TEXT NOT NULL,
    "bucket_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dream_review_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "freud_hearts" (
    "id" TEXT NOT NULL,
    "bucket_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "freud_hearts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "freud_snapshots" (
    "id" TEXT NOT NULL,
    "collection_id" TEXT NOT NULL,
    "algorithm" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "freud_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batch_emails" (
    "id" TEXT NOT NULL,
    "collection_id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "summary" TEXT,
    "message" TEXT NOT NULL,
    "sent_by_id" TEXT NOT NULL,
    "recipient_count" INTEGER NOT NULL,
    "recipients" JSONB NOT NULL,
    "bucket_ids" TEXT[],
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "batch_emails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "collection_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_messages" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_BucketDreamReviewTags" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_ConversationBuckets" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "dream_review_tags_collection_id_value_key" ON "dream_review_tags"("collection_id", "value");

-- CreateIndex
CREATE UNIQUE INDEX "dream_reviews_bucket_id_reviewer_id_key" ON "dream_reviews"("bucket_id", "reviewer_id");

-- CreateIndex
CREATE UNIQUE INDEX "freud_hearts_bucket_id_member_id_key" ON "freud_hearts"("bucket_id", "member_id");

-- CreateIndex
CREATE UNIQUE INDEX "_BucketDreamReviewTags_AB_unique" ON "_BucketDreamReviewTags"("A", "B");

-- CreateIndex
CREATE INDEX "_BucketDreamReviewTags_B_index" ON "_BucketDreamReviewTags"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_ConversationBuckets_AB_unique" ON "_ConversationBuckets"("A", "B");

-- CreateIndex
CREATE INDEX "_ConversationBuckets_B_index" ON "_ConversationBuckets"("B");

-- AddForeignKey
ALTER TABLE "dream_review_tags" ADD CONSTRAINT "dream_review_tags_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "Collection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dream_reviews" ADD CONSTRAINT "dream_reviews_bucket_id_fkey" FOREIGN KEY ("bucket_id") REFERENCES "Bucket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dream_reviews" ADD CONSTRAINT "dream_reviews_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "CollectionMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dream_review_comments" ADD CONSTRAINT "dream_review_comments_bucket_id_fkey" FOREIGN KEY ("bucket_id") REFERENCES "Bucket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dream_review_comments" ADD CONSTRAINT "dream_review_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "CollectionMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "freud_hearts" ADD CONSTRAINT "freud_hearts_bucket_id_fkey" FOREIGN KEY ("bucket_id") REFERENCES "Bucket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "freud_hearts" ADD CONSTRAINT "freud_hearts_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "CollectionMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "freud_snapshots" ADD CONSTRAINT "freud_snapshots_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "Collection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "freud_snapshots" ADD CONSTRAINT "freud_snapshots_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "CollectionMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_emails" ADD CONSTRAINT "batch_emails_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "Collection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_emails" ADD CONSTRAINT "batch_emails_sent_by_id_fkey" FOREIGN KEY ("sent_by_id") REFERENCES "CollectionMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "Collection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "CollectionMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "CollectionMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BucketDreamReviewTags" ADD CONSTRAINT "_BucketDreamReviewTags_A_fkey" FOREIGN KEY ("A") REFERENCES "Bucket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BucketDreamReviewTags" ADD CONSTRAINT "_BucketDreamReviewTags_B_fkey" FOREIGN KEY ("B") REFERENCES "dream_review_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ConversationBuckets" ADD CONSTRAINT "_ConversationBuckets_A_fkey" FOREIGN KEY ("A") REFERENCES "Bucket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ConversationBuckets" ADD CONSTRAINT "_ConversationBuckets_B_fkey" FOREIGN KEY ("B") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
