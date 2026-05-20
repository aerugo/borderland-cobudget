import { useRouter } from "next/router";
import SubMenu from "../../../../../components/SubMenu";
import FreudLayout from "../../../../../components/Freud/FreudLayout";
import ConversationList from "../../../../../components/Freud/Conversations/ConversationList";

const FreudConversationsPage = ({ round, currentUser, currentGroup }) => {
  const router = useRouter();
  const isAdminOrMod =
    currentUser?.currentCollMember?.isAdmin ||
    currentUser?.currentCollMember?.isModerator ||
    currentUser?.currentGroupMember?.isAdmin;

  if (!isAdminOrMod || !round) return null;

  return (
    <div className="flex-1">
      <SubMenu currentUser={currentUser} round={round} />
      <FreudLayout currentUser={currentUser} round={round}>
        <ConversationList
          round={round}
          groupSlug={router.query.group as string}
          roundSlug={router.query.round as string}
        />
      </FreudLayout>
    </div>
  );
};

export default FreudConversationsPage;
