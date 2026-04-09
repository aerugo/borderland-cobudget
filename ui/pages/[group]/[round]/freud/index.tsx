import { useRouter } from "next/router";
import { gql, useQuery } from "urql";
import SubMenu from "../../../../components/SubMenu";
import FreudLayout from "../../../../components/Freud/FreudLayout";
import BudgetSummaryPanel from "../../../../components/Freud/DreamReview/BudgetSummaryPanel";
import DreamReviewTable from "../../../../components/Freud/DreamReview/DreamReviewTable";
import { SummarySkeleton, TableSkeleton } from "../../../../components/Freud/LoadingSkeleton";

const DREAM_REVIEW_QUERY = gql`
  query DreamReviewTable($roundId: ID!) {
    dreamReviewTable(roundId: $roundId) {
      bucket {
        id
        title
        approved
        published
        createdAt
        cocreators {
          id
          user {
            id
            username
            name
          }
        }
      }
      goal
      stretch
      funded
      missing
      funders
      progress
      dreamReviewTags {
        id
        value
        color
      }
      reviewedBy {
        id
        user {
          id
          username
          name
        }
      }
      reviewCommentCount
    }
    dreamReviewTags(roundId: $roundId) {
      id
      value
      color
    }
  }
`;

const MEMBERS_QUERY = gql`
  query FreudMembers($roundId: ID!) {
    members(roundId: $roundId, isApproved: true) {
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
`;

const FreudReviewPage = ({ round, currentUser, currentGroup }) => {
  const router = useRouter();
  const isAdminOrMod =
    currentUser?.currentCollMember?.isAdmin ||
    currentUser?.currentCollMember?.isModerator ||
    currentUser?.currentGroupMember?.isAdmin;

  if (!isAdminOrMod || !round) return null;

  const groupSlug = router.query.group as string;
  const roundSlug = router.query.round as string;

  const [reviewResult] = useQuery({
    query: DREAM_REVIEW_QUERY,
    variables: { roundId: round.id },
    pause: !round?.id,
  });

  const [membersResult] = useQuery({
    query: MEMBERS_QUERY,
    variables: { roundId: round.id },
    pause: !round?.id,
  });

  const bucketData = reviewResult.data?.dreamReviewTable ?? [];
  const allTags = reviewResult.data?.dreamReviewTags ?? [];
  const allMembers = membersResult.data?.members ?? [];
  const adminModMembers = allMembers.filter(
    (m) => m.isAdmin || m.isModerator
  );

  const loading = reviewResult.fetching || membersResult.fetching;
  const error = reviewResult.error || membersResult.error;

  return (
    <div className="flex-1">
      <SubMenu currentUser={currentUser} round={round} />
      <FreudLayout currentUser={currentUser} round={round}>
        {error ? (
          <div className="text-center py-12">
            <div className="text-red-500 mb-2">Failed to load dream review data</div>
            <div className="text-xs text-gray-400">{error.message}</div>
          </div>
        ) : loading ? (
          <>
            <SummarySkeleton />
            <TableSkeleton rows={10} cols={8} />
          </>
        ) : (
          <>
            <BudgetSummaryPanel round={round} bucketData={bucketData} />
            <DreamReviewTable
              bucketData={bucketData}
              allTags={allTags}
              adminModMembers={adminModMembers}
              currentMemberId={currentUser?.currentCollMember?.id ?? ""}
              roundId={round.id}
              roundSlug={roundSlug}
              groupSlug={groupSlug}
              currency={round.currency}
            />
          </>
        )}
      </FreudLayout>
    </div>
  );
};

export default FreudReviewPage;
