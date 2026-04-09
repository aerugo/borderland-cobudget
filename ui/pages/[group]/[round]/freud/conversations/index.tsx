import SubMenu from "../../../../../components/SubMenu";
import FreudLayout from "../../../../../components/Freud/FreudLayout";

const FreudConversationsPage = ({ round, currentUser, currentGroup }) => {
  const isAdminOrMod =
    currentUser?.currentCollMember?.isAdmin ||
    currentUser?.currentCollMember?.isModerator ||
    currentUser?.currentGroupMember?.isAdmin;

  if (!isAdminOrMod || !round) return null;

  return (
    <div className="flex-1">
      <SubMenu currentUser={currentUser} round={round} />
      <FreudLayout currentUser={currentUser} round={round}>
        <div className="text-gray-500 text-center py-12">
          Dream Conversations — coming in Phase 6
        </div>
      </FreudLayout>
    </div>
  );
};

export default FreudConversationsPage;
