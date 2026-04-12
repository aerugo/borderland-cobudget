import prisma from "../../../prisma";
import { sendEmails } from "../../../send-email";

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

/**
 * Authorization gate for starting a new conversation. Policy:
 *   - Super admin sessions bypass.
 *   - Otherwise the caller must be logged in.
 *   - `bucketIds` must be non-empty and all referenced buckets must exist
 *     and belong to `roundId`.
 *   - Admins/mods of the round may link any buckets in the round.
 *   - Cocreators may only link buckets they cocreate — ALL buckets in the
 *     list must be ones the caller cocreates.
 */
async function assertCanCreateConversation(
  roundId: string,
  bucketIds: string[],
  ctx: { user?: { id: string } | null; ss?: any }
): Promise<void> {
  if (ctx?.ss) return;
  const userId = ctx?.user?.id;
  if (!userId) throw new Error("You need to be logged in");

  const uniqueBucketIds = Array.from(new Set(bucketIds));
  if (uniqueBucketIds.length === 0)
    throw new Error("At least one dream must be selected");

  const buckets = await prisma.bucket.findMany({
    where: { id: { in: uniqueBucketIds } },
    include: { cocreators: { select: { userId: true } } },
  });
  if (buckets.length !== uniqueBucketIds.length)
    throw new Error("One or more dreams not found");
  if (buckets.some((b) => b.roundId !== roundId))
    throw new Error("All dreams must belong to the same round");

  const member = await prisma.roundMember.findUnique({
    where: { userId_roundId: { userId, roundId } },
  });
  if (member?.isAdmin || member?.isModerator) return;

  const cocreatesAll = buckets.every((b) =>
    b.cocreators.some((cc) => cc.userId === userId)
  );
  if (!cocreatesAll)
    throw new Error("You can only start a conversation on dreams you cocreate");
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
// Dream Review Comments
// ═══════════════════════════════════════════

export const createDreamReviewComment = async (
  _parent,
  { bucketId, content },
  { user, ss }
) => {
  const roundId = await getRoundIdFromBucket(bucketId);
  await assertAdminOrMod(roundId, user?.id, ss);
  const member = await prisma.roundMember.findUnique({
    where: { userId_roundId: { userId: user.id, roundId } },
  });
  if (!member) throw new Error("Round member not found");
  const comment = await prisma.dreamReviewComment.create({
    data: { bucketId, authorId: member.id, content },
    include: { author: { include: { user: true } } },
  });

  // Parse @-mentions and send email notifications
  const mentionRegex = /@(\w+)/g;
  const mentions: string[] = [];
  let match;
  while ((match = mentionRegex.exec(content)) !== null) {
    mentions.push(match[1]);
  }

  if (mentions.length > 0) {
    const mentionedMembers = await prisma.roundMember.findMany({
      where: {
        roundId,
        user: { username: { in: mentions } },
        NOT: { userId: user.id },
      },
      include: { user: true },
    });

    if (mentionedMembers.length > 0) {
      const bucket = await prisma.bucket.findUnique({
        where: { id: bucketId },
        select: { title: true },
      });
      const authorName = comment.author?.user?.name || comment.author?.user?.username || "Someone";

      await sendEmails(
        mentionedMembers
          .filter((m) => m.user?.email)
          .map((m) => ({
            to: m.user.email,
            subject: `${authorName} mentioned you in a review note`,
            html: `<p><strong>${authorName}</strong> mentioned you in a note for <em>${bucket?.title ?? "a dream"}</em>:</p><p>${content}</p>`,
            text: `${authorName} mentioned you in a note for "${bucket?.title ?? "a dream"}":\n\n${content}`,
          })),
        true,
        false
      );
    }
  }

  return comment;
};

export const editDreamReviewComment = async (
  _parent,
  { id, content },
  { user, ss }
) => {
  const comment = await prisma.dreamReviewComment.findUnique({
    where: { id },
    include: { bucket: true, author: true },
  });
  if (!comment) throw new Error("Comment not found");
  await assertAdminOrMod(comment.bucket.roundId, user?.id, ss);
  return prisma.dreamReviewComment.update({
    where: { id },
    data: { content },
    include: { author: { include: { user: true } } },
  });
};

export const deleteDreamReviewComment = async (
  _parent,
  { id },
  { user, ss }
) => {
  const comment = await prisma.dreamReviewComment.findUnique({
    where: { id },
    include: { bucket: true },
  });
  if (!comment) throw new Error("Comment not found");
  await assertAdminOrMod(comment.bucket.roundId, user?.id, ss);
  await prisma.dreamReviewComment.delete({ where: { id } });
  return true;
};

// ═══════════════════════════════════════════
// FREUD Hearts
// ═══════════════════════════════════════════

export const toggleFreudHeart = async (
  _parent,
  { bucketId },
  { user, ss }
) => {
  const roundId = await getRoundIdFromBucket(bucketId);
  await assertAdminOrMod(roundId, user?.id, ss);
  const member = await prisma.roundMember.findUnique({
    where: { userId_roundId: { userId: user.id, roundId } },
  });
  if (!member) throw new Error("Round member not found");

  const existing = await prisma.freudHeart.findUnique({
    where: { bucketId_memberId: { bucketId, memberId: member.id } },
  });
  if (existing) {
    await prisma.freudHeart.delete({ where: { id: existing.id } });
    return false;
  } else {
    await prisma.freudHeart.create({
      data: { bucketId, memberId: member.id },
    });
    return true;
  }
};

// ═══════════════════════════════════════════
// FREUD Snapshots
// ═══════════════════════════════════════════

export const saveFreudSnapshot = async (
  _parent,
  { roundId, algorithm, data },
  { user, ss }
) => {
  await assertAdminOrMod(roundId, user?.id, ss);
  const member = await prisma.roundMember.findUnique({
    where: { userId_roundId: { userId: user.id, roundId } },
  });
  if (!member) throw new Error("Round member not found");
  return prisma.freudSnapshot.create({
    data: { roundId, algorithm, data, createdById: member.id },
    include: { createdBy: { include: { user: true } } },
  });
};

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
// Batch Emails
// ═══════════════════════════════════════════

export const sendBatchEmail = async (
  _parent,
  { roundId, subject, summary, message, bucketIds },
  { user, ss }
) => {
  await assertAdminOrMod(roundId, user?.id, ss);
  const member = await prisma.roundMember.findUnique({
    where: { userId_roundId: { userId: user.id, roundId } },
  });
  if (!member) throw new Error("Round member not found");

  // Rate limit: 1 batch per 5 min per round
  const recent = await prisma.batchEmail.findFirst({
    where: { roundId },
    orderBy: { sentAt: "desc" },
  });
  if (recent) {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    if (recent.sentAt > fiveMinAgo) {
      throw new Error("Please wait 5 minutes between batch emails");
    }
  }

  // Resolve recipients from selected buckets
  const buckets = await prisma.bucket.findMany({
    where: { id: { in: bucketIds } },
    include: { cocreators: { include: { user: true } } },
  });

  const recipientMap = new Map<
    string,
    { email: string; name: string; bucketTitle: string }
  >();
  for (const bucket of buckets) {
    for (const cc of bucket.cocreators) {
      const email = cc.user?.email;
      if (email && !recipientMap.has(email)) {
        recipientMap.set(email, {
          email,
          name: cc.user?.name || cc.user?.username || "",
          bucketTitle: bucket.title,
        });
      }
    }
  }

  const recipientsList = Array.from(recipientMap.values());

  const batchEmail = await prisma.batchEmail.create({
    data: {
      roundId,
      subject,
      summary,
      message,
      sentById: member.id,
      recipientCount: recipientsList.length,
      recipients: recipientsList,
      bucketIds,
    },
    include: { sentBy: { include: { user: true } } },
  });

  // Send emails via Postmark
  if (recipientsList.length > 0) {
    const round = await prisma.round.findUnique({
      where: { id: roundId },
      select: { title: true },
    });
    const footer = `<p style="color: #888; font-size: 12px; margin-top: 24px; border-top: 1px solid #eee; padding-top: 12px;">This email was sent by the Dream Team of ${round?.title ?? "your round"}.</p>`;

    await sendEmails(
      recipientsList.map((r) => ({
        to: r.email,
        subject,
        html: `${message}${footer}`,
        text: message.replace(/<[^>]*>/g, ""),
      })),
      true,
      true // broadcast stream
    );
  }

  return batchEmail;
};

// ═══════════════════════════════════════════
// Conversations
// ═══════════════════════════════════════════

export const createConversation = async (
  _parent,
  { roundId, title, bucketIds, initialMessage },
  { user, ss }
) => {
  await assertCanCreateConversation(roundId, bucketIds, { user, ss });
  const member = await prisma.roundMember.findUnique({
    where: { userId_roundId: { userId: user.id, roundId } },
    include: { user: true },
  });
  if (!member) throw new Error("Round member not found");

  const conversation = await prisma.conversation.create({
    data: {
      title,
      roundId,
      createdById: member.id,
      buckets: { connect: bucketIds.map((id) => ({ id })) },
      messages: {
        create: { content: initialMessage, authorId: member.id },
      },
    },
    include: {
      buckets: { include: { cocreators: { include: { user: true } } } },
      createdBy: { include: { user: true } },
      messages: { include: { author: { include: { user: true } } } },
      _count: { select: { messages: true } },
    },
  });

  // Notify co-creators of linked dreams + other admins/mods
  const recipientEmails = new Set<string>();
  for (const bucket of conversation.buckets) {
    for (const cc of bucket.cocreators) {
      if (cc.user?.email && cc.userId !== user.id) {
        recipientEmails.add(cc.user.email);
      }
    }
  }
  const otherAdminMods = await prisma.roundMember.findMany({
    where: {
      roundId,
      OR: [{ isAdmin: true }, { isModerator: true }],
      NOT: { userId: user.id },
    },
    include: { user: true },
  });
  for (const am of otherAdminMods) {
    if (am.user?.email) recipientEmails.add(am.user.email);
  }

  if (recipientEmails.size > 0) {
    const round = await prisma.round.findUnique({
      where: { id: roundId },
      include: { group: true },
    });
    const groupSlug = round?.group?.slug ?? "c";
    const roundSlug = round?.slug ?? "";
    const convUrl = `${process.env.DEPLOY_URL ? `https://${process.env.DEPLOY_URL}` : "http://localhost:3000"}/${groupSlug}/${roundSlug}/freud/conversations/${conversation.id}`;
    const authorName = member.user?.name || member.user?.username || "A Dream Team member";

    await sendEmails(
      Array.from(recipientEmails).map((email) => ({
        to: email,
        subject: `Dream Team: ${title}`,
        html: `<p><strong>${authorName}</strong> started a conversation:</p><p>${initialMessage}</p><p><a href="${convUrl}">View and reply</a></p>`,
        text: `${authorName} started a conversation: ${title}\n\n${initialMessage}\n\nView and reply: ${convUrl}`,
      })),
      true,
      true
    );
  }

  return conversation;
};

export const addConversationMessage = async (
  _parent,
  { conversationId, content },
  { user, ss }
) => {
  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { buckets: { include: { cocreators: true } } },
  });
  if (!conv) throw new Error("Conversation not found");

  if (!ss) {
    if (!user) throw new Error("You need to be logged in");
    const member = await prisma.roundMember.findUnique({
      where: { userId_roundId: { userId: user.id, roundId: conv.roundId } },
    });
    const isAdminMod = member?.isAdmin || member?.isModerator;
    const isCocreator = conv.buckets.some((b) =>
      b.cocreators.some((cc) => cc.userId === user.id)
    );
    if (!isAdminMod && !isCocreator)
      throw new Error("Not authorized to post in this conversation");
  }

  const member = await prisma.roundMember.findUnique({
    where: { userId_roundId: { userId: user.id, roundId: conv.roundId } },
  });

  const message = await prisma.conversationMessage.create({
    data: { conversationId, authorId: member.id, content },
    include: { author: { include: { user: true } } },
  });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });

  // Notify all participants except the author
  const fullConv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      buckets: { include: { cocreators: { include: { user: true } } } },
      round: { include: { group: true } },
    },
  });

  if (fullConv) {
    const recipientEmails = new Set<string>();
    for (const bucket of fullConv.buckets) {
      for (const cc of bucket.cocreators) {
        if (cc.user?.email && cc.userId !== user.id) {
          recipientEmails.add(cc.user.email);
        }
      }
    }
    const otherAdminMods = await prisma.roundMember.findMany({
      where: {
        roundId: fullConv.roundId,
        OR: [{ isAdmin: true }, { isModerator: true }],
        NOT: { userId: user.id },
      },
      include: { user: true },
    });
    for (const am of otherAdminMods) {
      if (am.user?.email) recipientEmails.add(am.user.email);
    }

    if (recipientEmails.size > 0) {
      const groupSlug = fullConv.round?.group?.slug ?? "c";
      const roundSlug = fullConv.round?.slug ?? "";
      const convUrl = `${process.env.DEPLOY_URL ? `https://${process.env.DEPLOY_URL}` : "http://localhost:3000"}/${groupSlug}/${roundSlug}/freud/conversations/${conversationId}`;
      const authorName = message.author?.user?.name || message.author?.user?.username || "Someone";

      await sendEmails(
        Array.from(recipientEmails).map((email) => ({
          to: email,
          subject: `Re: ${fullConv.title}`,
          html: `<p><strong>${authorName}</strong> replied:</p><p>${content}</p><p><a href="${convUrl}">View conversation</a></p>`,
          text: `${authorName} replied:\n\n${content}\n\nView conversation: ${convUrl}`,
        })),
        true,
        true
      );
    }
  }

  return message;
};

export const addBucketsToConversation = async (
  _parent,
  { conversationId, bucketIds },
  { user, ss }
) => {
  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
  });
  if (!conv) throw new Error("Conversation not found");
  await assertAdminOrMod(conv.roundId, user?.id, ss);

  const updated = await prisma.conversation.update({
    where: { id: conversationId },
    data: { buckets: { connect: bucketIds.map((id) => ({ id })) } },
    include: {
      buckets: true,
      createdBy: { include: { user: true } },
      messages: { include: { author: { include: { user: true } } } },
      _count: { select: { messages: true } },
    },
  });

  return updated;
};
