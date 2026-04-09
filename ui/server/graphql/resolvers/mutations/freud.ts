import prisma from "../../../prisma";

const notImplemented = () => {
  throw new Error("FREUD: Not implemented yet");
};

async function assertAdminOrMod(roundId: string, userId: string, ss: any) {
  if (ss) return;
  if (!userId) throw new Error("You need to be logged in");
  const member = await prisma.roundMember.findUnique({
    where: { userId_roundId: { userId, roundId } },
  });
  if (!member?.isAdmin && !member?.isModerator)
    throw new Error("You need to be admin or moderator of the round");
}

async function getRoundIdFromBucket(bucketId: string): Promise<string> {
  const bucket = await prisma.bucket.findUnique({
    where: { id: bucketId },
    select: { roundId: true },
  });
  if (!bucket) throw new Error("Bucket not found");
  return bucket.roundId;
}

// ═══════════════════════════════════════════
// Dream Review Tags
// ═══════════════════════════════════════════

export const createDreamReviewTag = async (
  _parent,
  { roundId, value, color },
  { user, ss }
) => {
  await assertAdminOrMod(roundId, user?.id, ss);
  return prisma.dreamReviewTag.create({
    data: {
      value,
      color: color || "#6B7280",
      roundId,
    },
  });
};

export const deleteDreamReviewTag = async (
  _parent,
  { id },
  { user, ss }
) => {
  const tag = await prisma.dreamReviewTag.findUnique({ where: { id } });
  if (!tag) throw new Error("Tag not found");
  await assertAdminOrMod(tag.roundId, user?.id, ss);
  return prisma.dreamReviewTag.delete({ where: { id } });
};

export const addDreamReviewTag = async (
  _parent,
  { bucketId, tagId },
  { user, ss }
) => {
  const roundId = await getRoundIdFromBucket(bucketId);
  await assertAdminOrMod(roundId, user?.id, ss);
  return prisma.bucket.update({
    where: { id: bucketId },
    data: { dreamReviewTags: { connect: { id: tagId } } },
  });
};

export const removeDreamReviewTag = async (
  _parent,
  { bucketId, tagId },
  { user, ss }
) => {
  const roundId = await getRoundIdFromBucket(bucketId);
  await assertAdminOrMod(roundId, user?.id, ss);
  return prisma.bucket.update({
    where: { id: bucketId },
    data: { dreamReviewTags: { disconnect: { id: tagId } } },
  });
};

// ═══════════════════════════════════════════
// Dream Review Assignment
// ═══════════════════════════════════════════

export const addDreamReviewer = async (
  _parent,
  { bucketId, reviewerId },
  { user, ss }
) => {
  const roundId = await getRoundIdFromBucket(bucketId);
  await assertAdminOrMod(roundId, user?.id, ss);
  return prisma.dreamReview.create({
    data: { bucketId, reviewerId },
    include: { reviewer: { include: { user: true } } },
  });
};

export const removeDreamReviewer = async (
  _parent,
  { bucketId, reviewerId },
  { user, ss }
) => {
  const roundId = await getRoundIdFromBucket(bucketId);
  await assertAdminOrMod(roundId, user?.id, ss);
  await prisma.dreamReview.delete({
    where: { bucketId_reviewerId: { bucketId, reviewerId } },
  });
  return true;
};

// ═══════════════════════════════════════════
// Dream Review Comments (Phase 3 stubs)
// ═══════════════════════════════════════════

export const createDreamReviewComment = notImplemented;
export const editDreamReviewComment = notImplemented;
export const deleteDreamReviewComment = notImplemented;

// ═══════════════════════════════════════════
// FREUD Hearts (Phase 4 stub)
// ═══════════════════════════════════════════

export const toggleFreudHeart = notImplemented;

// ═══════════════════════════════════════════
// FREUD Snapshots (Phase 4 stub)
// ═══════════════════════════════════════════

export const saveFreudSnapshot = notImplemented;

// ═══════════════════════════════════════════
// FREUD Total Budget
// ═══════════════════════════════════════════

export const setFreudTotalBudget = async (
  _parent,
  { roundId, amount },
  { user, ss }
) => {
  await assertAdminOrMod(roundId, user?.id, ss);
  return prisma.round.update({
    where: { id: roundId },
    data: { freudTotalBudget: amount },
  });
};

// ═══════════════════════════════════════════
// Batch Emails (Phase 5 stub)
// ═══════════════════════════════════════════

export const sendBatchEmail = notImplemented;

// ═══════════════════════════════════════════
// Conversations (Phase 6 stubs)
// ═══════════════════════════════════════════

export const createConversation = notImplemented;
export const addConversationMessage = notImplemented;
export const addBucketsToConversation = notImplemented;
