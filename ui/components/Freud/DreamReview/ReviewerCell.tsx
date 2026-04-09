import { useState } from "react";
import { gql, useMutation } from "urql";
import Tooltip from "@tippyjs/react";
import Avatar from "components/Avatar";

const ADD_REVIEWER = gql`
  mutation AddDreamReviewer($bucketId: ID!, $reviewerId: ID!) {
    addDreamReviewer(bucketId: $bucketId, reviewerId: $reviewerId) {
      id
      reviewer {
        id
        user {
          id
          username
        }
      }
    }
  }
`;

const REMOVE_REVIEWER = gql`
  mutation RemoveDreamReviewer($bucketId: ID!, $reviewerId: ID!) {
    removeDreamReviewer(bucketId: $bucketId, reviewerId: $reviewerId)
  }
`;

export default function ReviewerCell({
  bucketId,
  reviewedBy,
  adminModMembers,
  currentMemberId,
}: {
  bucketId: string;
  reviewedBy: { id: string; user: any }[];
  adminModMembers: { id: string; user: any }[];
  currentMemberId: string;
}) {
  const [open, setOpen] = useState(false);
  const [, addReviewer] = useMutation(ADD_REVIEWER);
  const [, removeReviewer] = useMutation(REMOVE_REVIEWER);

  const reviewerIds = new Set(reviewedBy.map((r) => r.id));

  const handleToggle = async (memberId: string) => {
    if (reviewerIds.has(memberId)) {
      await removeReviewer({ bucketId, reviewerId: memberId });
    } else {
      await addReviewer({ bucketId, reviewerId: memberId });
    }
  };

  const content = (
    <div className="bg-white border rounded shadow-lg p-2 min-w-[200px]">
      {!reviewerIds.has(currentMemberId) && (
        <button
          onClick={() => handleToggle(currentMemberId)}
          className="w-full px-2 py-1.5 text-sm rounded bg-blue-50 hover:bg-blue-100 text-blue-700 text-left mb-1 font-medium"
        >
          + Add me
        </button>
      )}
      {adminModMembers.map((member) => (
        <button
          key={member.id}
          onClick={() => handleToggle(member.id)}
          className={`flex items-center gap-2 w-full px-2 py-1 text-sm rounded hover:bg-gray-50 text-left ${
            reviewerIds.has(member.id) ? "bg-green-50" : ""
          }`}
        >
          <Avatar user={member.user} size="xs" />
          <span className="flex-1">
            {member.user?.name || member.user?.username || "Unknown"}
          </span>
          {reviewerIds.has(member.id) && (
            <span className="text-xs text-green-600">✓</span>
          )}
        </button>
      ))}
    </div>
  );

  return (
    <Tooltip
      content={content}
      interactive
      visible={open}
      onClickOutside={() => setOpen(false)}
      placement="bottom-start"
      appendTo={() => document.body}
      render={(attrs) => <div {...attrs}>{content}</div>}
    >
      <div
        className="flex items-center gap-1 cursor-pointer min-h-[24px]"
        onClick={() => setOpen(!open)}
      >
        {reviewedBy.map((reviewer) => (
          <div key={reviewer.id} className="flex items-center gap-1">
            <Avatar user={reviewer.user} size="xs" />
            <span className="text-xs text-gray-700 truncate max-w-[80px]">
              {reviewer.user?.name || reviewer.user?.username}
            </span>
          </div>
        ))}
        {reviewedBy.length === 0 && (
          <span className="text-gray-300 text-xs">Unreviewed</span>
        )}
        <span className="text-gray-400 text-xs ml-auto">▾</span>
      </div>
    </Tooltip>
  );
}
