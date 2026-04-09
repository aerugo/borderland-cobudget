import { gql, useQuery } from "urql";
import Link from "next/link";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

const BUCKET_CONVERSATIONS_QUERY = gql`
  query BucketConversations($bucketId: ID!) {
    bucketConversations(bucketId: $bucketId) {
      id
      title
      messageCount
      messages {
        id
        content
        createdAt
        author {
          id
          user {
            id
            username
            name
          }
        }
      }
    }
  }
`;

export default function BucketConversationIndicator({
  bucketId,
  groupSlug,
  roundSlug,
}: {
  bucketId: string;
  groupSlug: string;
  roundSlug: string;
}) {
  const [result] = useQuery({
    query: BUCKET_CONVERSATIONS_QUERY,
    variables: { bucketId },
    pause: !bucketId,
  });

  const conversations = result.data?.bucketConversations ?? [];

  if (result.fetching || conversations.length === 0) return null;

  return (
    <div className="max-w-screen-xl mx-auto px-2 md:px-4 py-3">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <div className="text-sm font-medium text-blue-800 mb-2">
          Dream Team Conversations
        </div>
        <div className="space-y-2">
          {conversations.map((conv) => {
            const lastMsg = conv.messages?.[0];
            return (
              <Link
                key={conv.id}
                href={`/${groupSlug}/${roundSlug}/freud/conversations/${conv.id}`}
                className="block bg-white rounded p-2 hover:bg-blue-50 transition-colors"
              >
                <div className="text-sm font-medium">{conv.title}</div>
                {lastMsg && (
                  <div className="text-xs text-gray-500 mt-0.5">
                    {lastMsg.author?.user?.name ||
                      lastMsg.author?.user?.username}
                    : {lastMsg.content.slice(0, 80)}
                    {lastMsg.content.length > 80 ? "..." : ""} ·{" "}
                    {dayjs(lastMsg.createdAt).fromNow()}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
