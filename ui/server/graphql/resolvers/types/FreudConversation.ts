export const messageCount = (parent) =>
  parent._count?.messages ?? parent.messages?.length ?? 0;

export const lastMessageAt = (parent) => {
  if (parent._lastMessageAt) return parent._lastMessageAt;
  const msgs = parent.messages;
  if (!msgs || msgs.length === 0) return null;
  return msgs[msgs.length - 1].createdAt;
};
