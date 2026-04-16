import { useState } from "react";
import Tooltip from "@tippyjs/react";
import dayjs from "dayjs";

interface ReviewAction {
  type: string;
  comment: string | null;
  guidelineTitle: string | null;
  createdAt: string;
}

interface FreudReviewer {
  member: { id: string; user: any } | null;
  lastVerdict: string | null;
  actions: ReviewAction[];
}

const ACTION_LABELS: Record<string, string> = {
  ALL_GOOD_FLAG: "✅ All Clear",
  RAISE_FLAG: "❌ Raised Flag",
  RESOLVE_FLAG: "🔧 Resolved Flag",
};

function ReviewerPopover({
  reviewer,
  onClose,
}: {
  reviewer: FreudReviewer;
  onClose: () => void;
}) {
  const name = reviewer.member
    ? reviewer.member.user?.name || reviewer.member.user?.username
    : "Unknown";

  return (
    <div
      className="bg-white border rounded-lg shadow-xl w-[320px] max-h-[350px] flex flex-col"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <div className="px-3 py-2 border-b flex items-center gap-2">
        <span className="text-sm font-medium flex-1 truncate">{name}</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="text-gray-400 hover:text-gray-700 leading-none text-lg px-1"
        >
          ×
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {reviewer.actions.length === 0 && (
          <div className="text-xs text-gray-400 text-center py-4">
            No review actions
          </div>
        )}
        {reviewer.actions.map((action, idx) => (
          <div key={idx}>
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-xs font-medium">
                {ACTION_LABELS[action.type] || action.type}
              </span>
              <span className="text-xs text-gray-400 ml-auto">
                {dayjs(action.createdAt).format("MMM D, YYYY [at] h:mm A")}
              </span>
            </div>
            {action.guidelineTitle && (
              <div className="text-xs text-gray-500 italic">
                {action.guidelineTitle}
              </div>
            )}
            {action.comment && (
              <div className="text-sm text-gray-700">{action.comment}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ReviewerCell({
  reviewedBy,
}: {
  reviewedBy: FreudReviewer[];
}) {
  const [openReviewerKey, setOpenReviewerKey] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-1.5 min-h-[24px] flex-wrap">
      {reviewedBy.map((r, idx) => {
        const key = r.member?.id ?? `unknown-${idx}`;
        const name = r.member
          ? r.member.user?.name || r.member.user?.username
          : "Unknown";
        return (
          <Tooltip
            key={key}
            content={
              openReviewerKey === key ? (
                <ReviewerPopover
                  reviewer={r}
                  onClose={() => setOpenReviewerKey(null)}
                />
              ) : (
                <span />
              )
            }
            interactive
            visible={openReviewerKey === key}
            onClickOutside={() => setOpenReviewerKey(null)}
            placement="bottom-start"
            appendTo={() => document.body}
            arrow={false}
            theme="freud-popover"
          >
            <button
              onClick={() =>
                setOpenReviewerKey(openReviewerKey === key ? null : key)
              }
              className="flex items-center gap-0.5 hover:bg-gray-100 rounded px-1 py-0.5 text-xs text-gray-700"
            >
              <span>
                {r.lastVerdict === "flag"
                  ? "❌"
                  : r.lastVerdict === "pass"
                  ? "✅"
                  : "⬜"}
              </span>
              <span className="truncate max-w-[80px]">{name}</span>
            </button>
          </Tooltip>
        );
      })}
      {reviewedBy.length === 0 && (
        <span className="text-gray-300 text-xs">—</span>
      )}
    </div>
  );
}
