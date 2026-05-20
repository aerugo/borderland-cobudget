import { useState, ReactNode } from "react";
import { gql, useQuery } from "urql";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import { CardListSkeleton } from "components/Freud/LoadingSkeleton";

dayjs.extend(relativeTime);

const BUCKET_PRIVATE_CONVERSATIONS_QUERY = gql`
  query BucketPrivateConversations($bucketId: ID!) {
    bucket(id: $bucketId) {
      id
      privateConversations {
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
  }
`;

type Props = {
  bucketId: string;
  canStart: boolean;
  isTeamMember: boolean;
  onOpenThread: (conversationId: string) => void;
  renderNewTopicForm: (onDone: () => void) => ReactNode;
};

export default function TopicList({
  bucketId,
  canStart,
  isTeamMember,
  onOpenThread,
  renderNewTopicForm,
}: Props) {
  const [showForm, setShowForm] = useState(false);

  const [{ data, fetching }] = useQuery({
    query: BUCKET_PRIVATE_CONVERSATIONS_QUERY,
    variables: { bucketId },
  });

  const conversations = data?.bucket?.privateConversations ?? [];

  const newTopicButton = canStart ? (
    <div className="mb-4 flex justify-end">
      <button
        type="button"
        onClick={() => setShowForm((s) => !s)}
        className="bg-blue-600 text-white px-4 py-2 rounded text-sm"
      >
        {showForm ? "Cancel" : "+ New topic"}
      </button>
    </div>
  ) : null;

  const formBlock =
    canStart && showForm ? renderNewTopicForm(() => setShowForm(false)) : null;

  if (fetching && !data) {
    return (
      <>
        {newTopicButton}
        {formBlock}
        <CardListSkeleton count={3} />
      </>
    );
  }

  if (conversations.length === 0) {
    return (
      <>
        {newTopicButton}
        {formBlock}
        <div className="flex flex-col items-center text-center py-10 text-gray-500">
          <LockOutlinedIcon
            className="text-gray-300"
            style={{ fontSize: 48 }}
          />
          <div className="mt-3 text-sm">No conversations yet.</div>
          <div className="mt-1 text-sm max-w-sm">
            {isTeamMember
              ? "Start one to reach this dream's cocreators privately."
              : "Start one to reach the Dream Team privately about this dream."}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {newTopicButton}
      {formBlock}
      <div className="space-y-2">
        {conversations.map((conv) => {
          const lastMsg = conv.messages?.[conv.messages.length - 1];
          const count = conv.messageCount ?? conv.messages?.length ?? 0;
          return (
            <button
              type="button"
              key={conv.id}
              onClick={() => onOpenThread(conv.id)}
              className="block w-full text-left bg-white border rounded-lg p-4 hover:border-blue-300 transition-colors"
            >
              <div className="font-medium text-sm">{conv.title}</div>
              {lastMsg && (
                <div className="text-xs text-gray-400 mt-1">
                  Last message: {dayjs(lastMsg.createdAt).fromNow()} by{" "}
                  {lastMsg.author?.user?.name ||
                    lastMsg.author?.user?.username}
                  {" · "}
                  {count} message{count !== 1 ? "s" : ""}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}
