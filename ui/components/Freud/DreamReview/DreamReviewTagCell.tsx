import { useState, useRef } from "react";
import { gql, useMutation } from "urql";
import Tooltip from "@tippyjs/react";

const ADD_TAG = gql`
  mutation AddDreamReviewTag($bucketId: ID!, $tagId: ID!) {
    addDreamReviewTag(bucketId: $bucketId, tagId: $tagId) {
      id
    }
  }
`;

const REMOVE_TAG = gql`
  mutation RemoveDreamReviewTag($bucketId: ID!, $tagId: ID!) {
    removeDreamReviewTag(bucketId: $bucketId, tagId: $tagId) {
      id
    }
  }
`;

export default function DreamReviewTagCell({
  bucketId,
  assignedTags,
  allTags,
}: {
  bucketId: string;
  assignedTags: { id: string; value: string; color: string }[];
  allTags: { id: string; value: string; color: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [, addTag] = useMutation(ADD_TAG);
  const [, removeTag] = useMutation(REMOVE_TAG);

  const assignedIds = new Set(assignedTags.map((t) => t.id));

  const handleToggle = async (tagId: string) => {
    if (assignedIds.has(tagId)) {
      await removeTag({ bucketId, tagId });
    } else {
      await addTag({ bucketId, tagId });
    }
  };

  const content = (
    <div className="bg-white border rounded shadow-lg p-2 min-w-[180px]">
      {allTags.length === 0 && (
        <div className="text-xs text-gray-400 p-1">No tags created yet</div>
      )}
      {allTags.map((tag) => (
        <button
          key={tag.id}
          onClick={() => handleToggle(tag.id)}
          className="flex items-center gap-2 w-full px-2 py-1 text-sm rounded hover:bg-gray-50 text-left"
        >
          <span
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: tag.color }}
          />
          <span className="flex-1">{tag.value}</span>
          {assignedIds.has(tag.id) && (
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
      arrow={false}
      theme="freud-popover"
    >
      <div
        className="flex flex-wrap gap-1 cursor-pointer min-h-[24px]"
        onClick={() => setOpen(!open)}
      >
        {assignedTags.map((tag) => (
          <span
            key={tag.id}
            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-white"
            style={{ backgroundColor: tag.color }}
          >
            {tag.value}
          </span>
        ))}
        {assignedTags.length === 0 && (
          <span className="text-gray-300 text-xs">—</span>
        )}
      </div>
    </Tooltip>
  );
}
