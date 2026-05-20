import { useRouter } from "next/router";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import ConversationThread from "components/Freud/Conversations/ConversationThread";
import TopicList from "./TopicList";
import NewTopicForm from "./NewTopicForm";

type Props = {
  bucket: {
    id: string;
    title: string;
    round: { id: string };
    canStartPrivateConversation: boolean;
  };
  canEditBucketSelection: boolean;
  isTeamMember: boolean;
};

export default function PrivateThreadsTab({
  bucket,
  canEditBucketSelection,
  isTeamMember,
}: Props) {
  const router = useRouter();

  const threadId = Array.isArray(router.query.thread)
    ? router.query.thread[0]
    : router.query.thread;

  const setThread = (conversationId: string) => {
    router.push(
      {
        pathname: router.pathname,
        query: { ...router.query, thread: conversationId },
      },
      undefined,
      { scroll: false }
    );
  };

  const clearThread = () => {
    const { thread, ...rest } = router.query;
    router.push(
      {
        pathname: router.pathname,
        query: rest,
      },
      undefined,
      { scroll: false }
    );
  };

  const switchToComments = () => {
    const { thread, ...rest } = router.query;
    router.push(
      {
        pathname: router.pathname,
        query: { ...rest, tab: "comments" },
      },
      undefined,
      { scroll: false }
    );
  };

  return (
    <div className="bg-white border-b-default">
      <div className="page grid gap-10 grid-cols-1 md:grid-cols-sidebar">
        <div>
          {threadId ? (
            <ConversationThread
              conversationId={threadId}
              onBack={clearThread}
              backLabel="Back to Dream Team"
              privateChannel
            />
          ) : (
            <>
              <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 mb-4 text-sm text-blue-900 flex items-start gap-2">
                <LockOutlinedIcon
                  fontSize="small"
                  className="mt-0.5 flex-shrink-0"
                />
                <div>
                  <span>
                    Private channel — visible only to this dream&apos;s
                    cocreators and the Dream Team.
                  </span>{" "}
                  <span className="text-blue-700">
                    Public comments are in the{" "}
                    <button
                      type="button"
                      onClick={switchToComments}
                      className="underline hover:text-blue-900"
                    >
                      Comments tab
                    </button>
                    .
                  </span>
                </div>
              </div>
              <TopicList
                bucketId={bucket.id}
                canStart={bucket.canStartPrivateConversation}
                isTeamMember={isTeamMember}
                onOpenThread={setThread}
                renderNewTopicForm={(onDone) => (
                  <NewTopicForm
                    roundId={bucket.round.id}
                    bucket={{ id: bucket.id, title: bucket.title }}
                    canEditBucketSelection={canEditBucketSelection}
                    onCreated={(id) => {
                      onDone();
                      setThread(id);
                    }}
                    onCancel={onDone}
                  />
                )}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
