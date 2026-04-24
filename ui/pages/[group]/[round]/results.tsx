import SubMenu from "components/SubMenu";
import RoundResults from "components/RoundResults";

const ResultsPage = ({ round, currentUser }) => {
  if (!round) return null;
  return (
    <div>
      <SubMenu currentUser={currentUser} round={round} />
      <RoundResults round={round} />
    </div>
  );
};

export default ResultsPage;
