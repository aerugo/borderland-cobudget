import SubMenu from "../../../../components/SubMenu";
import FreudLayout from "../../../../components/Freud/FreudLayout";
import RedistributionPage from "../../../../components/Freud/Redistribution/RedistributionPage";

const FreudRedistributionPage = ({ round, currentUser, currentGroup }) => {
  const isAdminOrMod =
    currentUser?.currentCollMember?.isAdmin ||
    currentUser?.currentCollMember?.isModerator ||
    currentUser?.currentGroupMember?.isAdmin;

  if (!isAdminOrMod || !round) return null;

  return (
    <div className="flex-1">
      <SubMenu currentUser={currentUser} round={round} />
      <FreudLayout currentUser={currentUser} round={round}>
        <RedistributionPage round={round} currentUser={currentUser} />
      </FreudLayout>
    </div>
  );
};

export default FreudRedistributionPage;
