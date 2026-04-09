import prisma from "../../../prisma";
import { getRoundMember } from "../helpers";

async function assertAdminOrMod(roundId: string, userId: string, ss: any) {
  if (ss) return; // super admin bypass
  if (!userId) throw new Error("You need to be logged in");
  const member = await prisma.roundMember.findUnique({
    where: { userId_roundId: { userId, roundId } },
  });
  if (!member?.isAdmin && !member?.isModerator)
    throw new Error("You need to be admin or moderator of the round");
}

export const dreamReviewTable = async (
  _parent,
  { roundId },
  { user, ss }
) => {
  await assertAdminOrMod(roundId, user?.id, ss);

  const buckets = await prisma.bucket.findMany({
    where: { roundId, deleted: { not: true } },
    include: {
      dreamReviewTags: true,
      dreamReviews: { include: { reviewer: { include: { user: true } } } },
      _count: { select: { dreamReviewComments: true } },
      cocreators: { include: { user: true } },
      tags: true,
      BudgetItems: true,
      Contributions: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return buckets.map((bucket) => {
    const minGoal = bucket.BudgetItems.reduce(
      (acc, item) => acc + (item.type === "EXPENSE" ? item.min : 0),
      0
    );
    const maxGoal = bucket.BudgetItems.reduce(
      (acc, item) =>
        acc + (item.type === "EXPENSE" ? (item.max ?? item.min) : 0),
      0
    );
    const funded = bucket.Contributions.reduce(
      (acc, c) => acc + c.amount,
      0
    );
    const funderIds = new Set(
      bucket.Contributions.map((c) => c.roundMemberId)
    );

    return {
      bucket,
      goal: minGoal,
      stretch: maxGoal,
      funded,
      missing: minGoal - funded,
      funders: funderIds.size,
      progress: minGoal > 0 ? funded / minGoal : 0,
      dreamReviewTags: bucket.dreamReviewTags,
      hearts: [],
      reviewedBy: bucket.dreamReviews.map((r) => r.reviewer),
      reviewCommentCount: bucket._count.dreamReviewComments,
    };
  });
};

export const dreamReviewTags = async (
  _parent,
  { roundId },
  { user, ss }
) => {
  await assertAdminOrMod(roundId, user?.id, ss);
  return prisma.dreamReviewTag.findMany({
    where: { roundId },
    orderBy: { value: "asc" },
  });
};

export const dreamReviewComments = async (
  _parent,
  { bucketId },
  { user, ss }
) => {
  const bucket = await prisma.bucket.findUnique({
    where: { id: bucketId },
  });
  if (!bucket) throw new Error("Bucket not found");
  await assertAdminOrMod(bucket.roundId, user?.id, ss);

  return prisma.dreamReviewComment.findMany({
    where: { bucketId },
    include: { author: { include: { user: true } } },
    orderBy: { createdAt: "asc" },
  });
};

export const freudData = async (
  _parent,
  { roundId },
  { user, ss }
) => {
  await assertAdminOrMod(roundId, user?.id, ss);

  const buckets = await prisma.bucket.findMany({
    where: { roundId, deleted: { not: true } },
    include: {
      dreamReviewTags: true,
      dreamReviews: { include: { reviewer: { include: { user: true } } } },
      freudHearts: { include: { member: { include: { user: true } } } },
      tags: true,
      BudgetItems: true,
      Contributions: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return buckets.map((bucket) => {
    const minGoal = bucket.BudgetItems.reduce(
      (acc, item) => acc + (item.type === "EXPENSE" ? item.min : 0),
      0
    );
    const maxGoal = bucket.BudgetItems.reduce(
      (acc, item) =>
        acc + (item.type === "EXPENSE" ? (item.max ?? item.min) : 0),
      0
    );
    const funded = bucket.Contributions.reduce(
      (acc, c) => acc + c.amount,
      0
    );
    const funderIds = new Set(
      bucket.Contributions.map((c) => c.roundMemberId)
    );

    return {
      bucket,
      goal: minGoal,
      stretch: maxGoal,
      funded,
      missing: minGoal - funded,
      funders: funderIds.size,
      progress: minGoal > 0 ? funded / minGoal : 0,
      dreamReviewTags: bucket.dreamReviewTags,
      hearts: bucket.freudHearts,
      reviewedBy: bucket.dreamReviews.map((r) => r.reviewer),
      reviewCommentCount: 0,
    };
  });
};

export const freudSnapshots = async (
  _parent,
  { roundId },
  { user, ss }
) => {
  await assertAdminOrMod(roundId, user?.id, ss);
  return prisma.freudSnapshot.findMany({
    where: { roundId },
    include: { createdBy: { include: { user: true } } },
    orderBy: { createdAt: "desc" },
  });
};

export const bucketConversations = async (
  _parent,
  { bucketId },
  { user, ss }
) => {
  if (!user && !ss) throw new Error("You need to be logged in");

  const bucket = await prisma.bucket.findUnique({
    where: { id: bucketId },
    include: { cocreators: true },
  });
  if (!bucket) return [];

  // Check if user is admin/mod or cocreator
  if (!ss) {
    const member = await prisma.roundMember.findUnique({
      where: { userId_roundId: { userId: user.id, roundId: bucket.roundId } },
    });
    const isAdminMod = member?.isAdmin || member?.isModerator;
    const isCocreator = bucket.cocreators.some((cc) => cc.userId === user.id);
    if (!isAdminMod && !isCocreator) return [];
  }

  return prisma.conversation.findMany({
    where: {
      buckets: { some: { id: bucketId } },
    },
    include: {
      buckets: true,
      createdBy: { include: { user: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1, include: { author: { include: { user: true } } } },
      _count: { select: { messages: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
};

export const batchEmails = async (
  _parent,
  { roundId },
  { user, ss }
) => {
  await assertAdminOrMod(roundId, user?.id, ss);
  return prisma.batchEmail.findMany({
    where: { roundId },
    include: { sentBy: { include: { user: true } } },
    orderBy: { sentAt: "desc" },
  });
};

export const conversations = async (
  _parent,
  { roundId },
  { user, ss }
) => {
  if (!user && !ss) throw new Error("You need to be logged in");

  // Check if admin/mod — if so, show all conversations
  let isAdminMod = false;
  if (ss) {
    isAdminMod = true;
  } else {
    const member = await prisma.roundMember.findUnique({
      where: { userId_roundId: { userId: user.id, roundId } },
    });
    isAdminMod = !!(member?.isAdmin || member?.isModerator);

    if (!isAdminMod) {
      // Co-creators see only conversations linked to their dreams
      if (!member) throw new Error("Not a round member");
      return prisma.conversation.findMany({
        where: {
          roundId,
          buckets: { some: { cocreators: { some: { id: member.id } } } },
        },
        include: {
          buckets: true,
          createdBy: { include: { user: true } },
          messages: { orderBy: { createdAt: "desc" }, take: 1, include: { author: { include: { user: true } } } },
          _count: { select: { messages: true } },
        },
        orderBy: { updatedAt: "desc" },
      });
    }
  }

  return prisma.conversation.findMany({
    where: { roundId },
    include: {
      buckets: true,
      createdBy: { include: { user: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1, include: { author: { include: { user: true } } } },
      _count: { select: { messages: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
};

export const conversation = async (
  _parent,
  { id },
  { user, ss }
) => {
  const conv = await prisma.conversation.findUnique({
    where: { id },
    include: {
      buckets: { include: { cocreators: true } },
      createdBy: { include: { user: true } },
      messages: {
        include: { author: { include: { user: true } } },
        orderBy: { createdAt: "asc" },
      },
      _count: { select: { messages: true } },
    },
  });
  if (!conv) return null;

  if (!ss) {
    if (!user) throw new Error("You need to be logged in");
    const member = await prisma.roundMember.findUnique({
      where: { userId_roundId: { userId: user.id, roundId: conv.roundId } },
    });
    const isAdminMod = member?.isAdmin || member?.isModerator;
    const isCocreator = conv.buckets.some((b) =>
      b.cocreators.some((cc) => cc.userId === user.id)
    );
    if (!isAdminMod && !isCocreator) return null;
  }

  return conv;
};
