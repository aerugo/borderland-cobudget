import prisma from "../../../prisma";

type ConversationScopingCtx = {
  user?: { id: string } | null;
  ss?: any;
};

/**
 * Pure predicate: given a bucket (with its cocreators preloaded) and the
 * request context, decide whether the viewer may see/act on the bucket's
 * private conversations. Shared by the Bucket field resolvers and the
 * `assertCanCreateConversation` mutation gate.
 */
export async function viewerCanAccessBucketConversations(
  bucket: {
    id: string;
    roundId: string;
    cocreators: { userId: string }[];
  },
  ctx: ConversationScopingCtx
): Promise<boolean> {
  if (ctx?.ss) return true;
  const userId = ctx?.user?.id;
  if (!userId) return false;
  if (bucket.cocreators.some((cc) => cc.userId === userId)) return true;
  const member = await prisma.roundMember.findUnique({
    where: { userId_roundId: { userId, roundId: bucket.roundId } },
  });
  return !!(member?.isAdmin || member?.isModerator);
}

/**
 * Viewer-scoped list of private conversations linked to a bucket.
 *
 * Returns `[]` for signed-out viewers, unknown buckets, or viewers with no
 * access (non-admin, non-mod, non-cocreator). Shared by the
 * `bucketConversations` query and the `Bucket.privateConversations` field.
 */
export async function getViewerScopedBucketConversations(
  bucketId: string,
  ctx: ConversationScopingCtx
) {
  if (!ctx?.user && !ctx?.ss) return [];

  const bucket = await prisma.bucket.findUnique({
    where: { id: bucketId },
    include: { cocreators: { select: { userId: true } } },
  });
  if (!bucket) return [];

  const canAccess = await viewerCanAccessBucketConversations(bucket, ctx);
  if (!canAccess) return [];

  return prisma.conversation.findMany({
    where: {
      buckets: { some: { id: bucketId } },
    },
    include: {
      buckets: true,
      createdBy: { include: { user: true } },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { author: { include: { user: true } } },
      },
      _count: { select: { messages: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
}
