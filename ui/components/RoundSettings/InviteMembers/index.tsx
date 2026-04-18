import { FormattedMessage } from "react-intl";

import GlobalBurnSection from "./GlobalBurnSection";

const InviteMembers = ({
  round,
  currentGroup,
  currentUser,
}: {
  round: any;
  currentGroup: any;
  currentUser: any;
}) => {
  return (
    <div className="px-6">
      <h2 className="text-2xl font-semibold">
        <FormattedMessage defaultMessage="Invite members" />
      </h2>
      <GlobalBurnSection
        round={round}
        currentGroup={currentGroup}
        currentUser={currentUser}
      />
    </div>
  );
};

export default InviteMembers;
