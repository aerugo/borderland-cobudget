import prisma from "../../../prisma";
import { getRoundMember } from "../helpers";
import { getViewerScopedBucketConversations } from "../helpers/conversationAccess";

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
      _count: { select: { dreamReviewComments: true } },
      flags: {
        include: { collMember: { include: { user: true } }, guideline: true },
        orderBy: { createdAt: "asc" },
      },
      dreamReviews: { include: { reviewer: { include: { user: true } } } },
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

    // Derive reviewers from flag actions (peer review),
    // ordered by most recent action last.
    // Flags before FLAG_ATTRIBUTION_FIX_DATE have unreliable collMemberId
    // due to a bug where the wrong round member was stored.
    const FLAG_ATTRIBUTION_FIX_DATE = new Date("2026-04-16T18:00:00Z");

    const reviewerMap = new Map<string, {
      member: any;
      lastVerdict: string | null;
      lastActionAt: Date;
      actions: { type: string; comment: string | null; guidelineTitle: string | null; createdAt: Date }[];
    }>();
    const UNKNOWN_KEY = "__unknown__";

    for (const f of bucket.flags) {
      const isTrusted = f.createdAt >= FLAG_ATTRIBUTION_FIX_DATE;
      let verdict: string | null = null;
      if (f.type === "ALL_GOOD_FLAG") verdict = "pass";
      else if (f.type === "RAISE_FLAG") verdict = "flag";

      const action = {
        type: f.type,
        comment: f.comment,
        guidelineTitle: f.guideline?.title ?? null,
        createdAt: f.createdAt,
      };

      const key = isTrusted ? f.collMemberId : UNKNOWN_KEY;
      const member = isTrusted ? f.collMember : null;

      const existing = reviewerMap.get(key);
      if (!existing) {
        reviewerMap.set(key, {
          member,
          lastVerdict: verdict,
          lastActionAt: f.createdAt,
          actions: [action],
        });
      } else {
        existing.lastActionAt = f.createdAt;
        existing.actions.push(action);
        if (verdict) {
          existing.lastVerdict = verdict;
        }
      }
    }
    const reviewedBy = Array.from(reviewerMap.values())
      .sort((a, b) => new Date(a.lastActionAt).getTime() - new Date(b.lastActionAt).getTime())
      .map(({ member, lastVerdict, actions }) => ({ member, lastVerdict, actions }));

    return {
      bucket,
      goal: minGoal / 100,
      stretch: maxGoal / 100,
      funded: funded / 100,
      missing: (minGoal - funded) / 100,
      funders: funderIds.size,
      progress: minGoal > 0 ? funded / minGoal : 0,
      dreamReviewTags: bucket.dreamReviewTags,
      hearts: [],
      reviewedBy,
      assignedTo: bucket.dreamReviews.map((r) => r.reviewer),
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
      flags: {
        include: { collMember: { include: { user: true } }, guideline: true },
        orderBy: { createdAt: "asc" },
      },
      dreamReviews: { include: { reviewer: { include: { user: true } } } },
      freudHearts: { include: { member: { include: { user: true } } } },
      tags: true,
      BudgetItems: true,
      Contributions: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const FLAG_ATTRIBUTION_FIX_DATE = new Date("2026-04-16T18:00:00Z");
  const UNKNOWN_KEY = "__unknown__";

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

    const reviewerMap = new Map<string, {
      member: any;
      lastVerdict: string | null;
      lastActionAt: Date;
      actions: { type: string; comment: string | null; guidelineTitle: string | null; createdAt: Date }[];
    }>();
    for (const f of bucket.flags) {
      const isTrusted = f.createdAt >= FLAG_ATTRIBUTION_FIX_DATE;
      let verdict: string | null = null;
      if (f.type === "ALL_GOOD_FLAG") verdict = "pass";
      else if (f.type === "RAISE_FLAG") verdict = "flag";

      const action = {
        type: f.type,
        comment: f.comment,
        guidelineTitle: f.guideline?.title ?? null,
        createdAt: f.createdAt,
      };

      const key = isTrusted ? f.collMemberId : UNKNOWN_KEY;
      const member = isTrusted ? f.collMember : null;

      const existing = reviewerMap.get(key);
      if (!existing) {
        reviewerMap.set(key, { member, lastVerdict: verdict, lastActionAt: f.createdAt, actions: [action] });
      } else {
        existing.lastActionAt = f.createdAt;
        existing.actions.push(action);
        if (verdict) existing.lastVerdict = verdict;
      }
    }
    const reviewedBy = Array.from(reviewerMap.values())
      .sort((a, b) => new Date(a.lastActionAt).getTime() - new Date(b.lastActionAt).getTime())
      .map(({ member, lastVerdict, actions }) => ({ member, lastVerdict, actions }));

    return {
      bucket,
      goal: minGoal / 100,
      stretch: maxGoal / 100,
      funded: funded / 100,
      missing: (minGoal - funded) / 100,
      funders: funderIds.size,
      progress: minGoal > 0 ? funded / minGoal : 0,
      dreamReviewTags: bucket.dreamReviewTags,
      hearts: bucket.freudHearts,
      reviewedBy,
      assignedTo: bucket.dreamReviews.map((r) => r.reviewer),
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
  return getViewerScopedBucketConversations(bucketId, { user, ss });
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
