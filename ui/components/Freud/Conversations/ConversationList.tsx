import { useState } from "react";
import { gql, useQuery, useMutation } from "urql";
import Link from "next/link";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import toast from "react-hot-toast";

dayjs.extend(relativeTime);

const CONVERSATIONS_QUERY = gql`
  query Conversations($roundId: ID!) {
    conversations(roundId: $roundId) {
      id
      title
      messageCount
      createdAt
      buckets {
        id
        title
      }
      createdBy {
        id
        user {
          id
          username
          name
        }
      }
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

const BUCKETS_QUERY = gql`
  query ConvBuckets($roundId: ID!) {
    dreamReviewTable(roundId: $roundId) {
      bucket {
        id
        title
      }
    }
  }
`;

const CREATE_CONVERSATION = gql`
  mutation CreateConversation(
    $roundId: ID!
    $title: String!
    $bucketIds: [ID!]!
    $initialMessage: String!
  ) {
    createConversation(
      roundId: $roundId
      title: $title
      bucketIds: $bucketIds
      initialMessage: $initialMessage
    ) {
      id
      title
    }
  }
`;

export default function ConversationList({
  round,
  groupSlug,
  roundSlug,
}: {
  round: any;
  groupSlug: string;
  roundSlug: string;
}) {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [selectedBucketIds, setSelectedBucketIds] = useState<Set<string>>(new Set());

  const [convResult] = useQuery({
    query: CONVERSATIONS_QUERY,
    variables: { roundId: round.id },
  });
  const [bucketsResult] = useQuery({
    query: BUCKETS_QUERY,
    variables: { roundId: round.id },
  });
  const [, createConversation] = useMutation(CREATE_CONVERSATION);

  const conversations = convResult.data?.conversations ?? [];
  const allBuckets = bucketsResult.data?.dreamReviewTable ?? [];

  const handleCreate = async () => {
    if (!title.trim() || !message.trim() || selectedBucketIds.size === 0) return;
    const result = await createConversation({
      roundId: round.id,
      title: title.trim(),
      bucketIds: Array.from(selectedBucketIds),
      initialMessage: message.trim(),
    });
    if (result.error) {
      toast.error(result.error.message);
    } else {
      toast.success("Conversation created");
      setShowForm(false);
      setTitle("");
      setMessage("");
      setSelectedBucketIds(new Set());
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-lg">Conversations</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm"
        >
          {showForm ? "Cancel" : "New Conversation"}
        </button>
      </div>

      {/* New Conversation Form */}
      {showForm && (
        <div className="bg-white border rounded-lg p-4 mb-4 space-y-3">
          <input
            type="text"
            placeholder="Conversation title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="border rounded px-3 py-2 w-full text-sm"
          />
          <div>
            <div className="text-sm font-medium mb-1">Link to dreams:</div>
            <div className="max-h-32 overflow-y-auto border rounded p-2 space-y-1">
              {allBuckets.map((d) => (
                <label
                  key={d.bucket.id}
                  className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 px-1"
                >
                  <input
                    type="checkbox"
                    checked={selectedBucketIds.has(d.bucket.id)}
                    onChange={() => {
                      setSelectedBucketIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(d.bucket.id)) next.delete(d.bucket.id);
                        else next.add(d.bucket.id);
                        return next;
                      });
                    }}
                  />
                  <span className="truncate">{d.bucket.title}</span>
                </label>
              ))}
            </div>
          </div>
          <textarea
            placeholder="Initial message..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            className="border rounded px-3 py-2 w-full text-sm"
          />
          <button
            onClick={handleCreate}
            disabled={!title.trim() || !message.trim() || selectedBucketIds.size === 0}
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm disabled:opacity-50"
          >
            Create Conversation
          </button>
        </div>
      )}

      {/* Conversation List */}
      {convResult.fetching ? (
        <div className="text-center text-gray-400 py-8">Loading...</div>
      ) : conversations.length === 0 ? (
        <div className="text-center text-gray-400 py-8">
          No conversations yet. Start one to reach out to dreamers.
        </div>
      ) : (
        <div className="space-y-2">
          {conversations.map((conv) => {
            const lastMsg = conv.messages?.[0];
            return (
              <Link
                key={conv.id}
                href={`/${groupSlug}/${roundSlug}/freud/conversations/${conv.id}`}
                className="block bg-white border rounded-lg p-4 hover:border-blue-300 transition-colors"
              >
                <div className="font-medium text-sm">{conv.title}</div>
                <div className="text-xs text-gray-500 mt-1">
                  Dreams:{" "}
                  {conv.buckets.map((b) => b.title).join(", ")}
                </div>
                {lastMsg && (
                  <div className="text-xs text-gray-400 mt-1">
                    Last message: {dayjs(lastMsg.createdAt).fromNow()} by{" "}
                    {lastMsg.author?.user?.name || lastMsg.author?.user?.username}
                    {" · "}
                    {conv.messageCount ?? conv.messages?.length} message
                    {(conv.messageCount ?? conv.messages?.length) !== 1 ? "s" : ""}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
