import { useRouter } from "next/router";
import SubMenu from "../../../../../components/SubMenu";
import FreudLayout from "../../../../../components/Freud/FreudLayout";
import ConversationThread from "../../../../../components/Freud/Conversations/ConversationThread";

const FreudConversationPage = ({ round, currentUser, currentGroup }) => {
  const router = useRouter();
  const conversationId = router.query.conversationId as string;

  // Allow cocreators too (not just admin/mod) — authorization is handled server-side
  if (!currentUser || !round) return null;

  return (
    <div className="flex-1">
      <SubMenu currentUser={currentUser} round={round} />
      <FreudLayout currentUser={currentUser} round={round}>
        {conversationId && (
          <ConversationThread
            conversationId={conversationId}
            backHref={`/${router.query.group}/${router.query.round}/freud/conversations`}
            backLabel="Back to Conversations"
          />
        )}
      </FreudLayout>
    </div>
  );
};

export default FreudConversationPage;
