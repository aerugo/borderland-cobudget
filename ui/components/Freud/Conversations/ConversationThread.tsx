import { useState } from "react";
import { gql, useQuery, useMutation } from "urql";
import Link from "next/link";
import dayjs from "dayjs";
import Avatar from "components/Avatar";

const CONVERSATION_QUERY = gql`
  query Conversation($id: ID!) {
    conversation(id: $id) {
      id
      title
      createdAt
      buckets {
        id
        title
        cocreators {
          id
          isAdmin
          isModerator
          user {
            id
            username
            name
          }
        }
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
          isAdmin
          isModerator
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

const ADD_MESSAGE = gql`
  mutation AddConversationMessage($conversationId: ID!, $content: String!) {
    addConversationMessage(conversationId: $conversationId, content: $content) {
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
`;

export default function ConversationThread({
  conversationId,
  groupSlug,
  roundSlug,
}: {
  conversationId: string;
  groupSlug: string;
  roundSlug: string;
}) {
  const [input, setInput] = useState("");

  const [result, reexecute] = useQuery({
    query: CONVERSATION_QUERY,
    variables: { id: conversationId },
  });
  const [sendResult, addMessage] = useMutation(ADD_MESSAGE);

  const conv = result.data?.conversation;

  if (result.fetching) {
    return <div className="text-center text-gray-400 py-8">Loading...</div>;
  }

  if (!conv) {
    return (
      <div className="text-center text-gray-400 py-8">
        Conversation not found or you don't have access.
      </div>
    );
  }

  // Compute participant summary
  const teamMembers: string[] = [];
  const cocreatorCount = new Set<string>();
  for (const bucket of conv.buckets) {
    for (const cc of bucket.cocreators ?? []) {
      if (cc.isAdmin || cc.isModerator) {
        const name = cc.user?.name || cc.user?.username;
        if (name && !teamMembers.includes(name)) teamMembers.push(name);
      } else {
        cocreatorCount.add(cc.id);
      }
    }
  }
  const participantSummary = [
    teamMembers.length > 0
      ? `${teamMembers.join(", ")} (Dream Team)`
      : null,
    cocreatorCount.size > 0
      ? `${cocreatorCount.size} co-creator${cocreatorCount.size !== 1 ? "s" : ""}`
      : null,
  ]
    .filter(Boolean)
    .join(" + ");

  const handleSend = async () => {
    if (!input.trim()) return;
    await addMessage({
      conversationId,
      content: input.trim(),
    });
    setInput("");
    reexecute({ requestPolicy: "network-only" });
  };

  return (
    <div>
      <Link
        href={`/${groupSlug}/${roundSlug}/freud/conversations`}
        className="text-sm text-blue-600 hover:underline mb-4 block"
      >
        ← Back to Conversations
      </Link>

      <h2 className="font-semibold text-xl mb-1">{conv.title}</h2>
      <div className="text-sm text-gray-500 mb-1">
        Dreams: {conv.buckets.map((b) => b.title).join(" · ")}
      </div>
      <div className="text-xs text-gray-400 mb-1">
        Started by{" "}
        {conv.createdBy?.user?.name || conv.createdBy?.user?.username} on{" "}
        {dayjs(conv.createdAt).format("MMM D, YYYY")}
      </div>
      {participantSummary && (
        <div className="text-xs text-gray-400 mb-6">
          Participants: {participantSummary}
        </div>
      )}

      {/* Messages */}
      <div className="space-y-4 mb-6">
        {conv.messages.map((msg) => {
          const isAdmin = msg.author?.isAdmin || msg.author?.isModerator;
          return (
            <div key={msg.id} className="flex gap-3">
              <Avatar user={msg.author?.user} size="sm" />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-medium">
                    {msg.author?.user?.name || msg.author?.user?.username}
                  </span>
                  {isAdmin && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                      Dream Team
                    </span>
                  )}
                  <span className="text-xs text-gray-400">
                    {dayjs(msg.createdAt).format("MMM D, YYYY [at] h:mm A")}
                  </span>
                </div>
                <div className="text-sm text-gray-700 whitespace-pre-wrap">
                  {msg.content}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Reply */}
      <div className="border rounded-lg p-3 bg-white">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Write a reply..."
          rows={3}
          className="w-full border rounded px-3 py-2 text-sm mb-2 resize-none"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        <div className="flex justify-end">
          <button
            onClick={handleSend}
            disabled={!input.trim() || sendResult.fetching}
            className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
