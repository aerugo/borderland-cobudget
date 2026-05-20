import Tooltip from "@tippyjs/react";

interface Heart {
  id: string;
  member: {
    id: string;
    user?: { id: string; username?: string | null; name?: string | null } | null;
  } | null;
}

interface HeartCellProps {
  hearts: Heart[];
  currentMemberId: string | null;
  onToggle: () => void;
}

function displayName(h: Heart): string {
  return h.member?.user?.name || h.member?.user?.username || "Unknown";
}

export default function HeartCell({
  hearts,
  currentMemberId,
  onToggle,
}: HeartCellProps) {
  const count = hearts.length;
  const userHasHearted =
    !!currentMemberId &&
    hearts.some((h) => h.member?.id === currentMemberId);

  const popoverContent = (
    <div className="bg-white border rounded-lg shadow-xl py-1 min-w-[160px]">
      {hearts.length === 0 ? (
        <div className="px-3 py-1.5 text-xs text-gray-400">
          No hearts yet
        </div>
      ) : (
        hearts.map((h) => (
          <div
            key={h.id}
            className="px-3 py-1 text-xs text-gray-700 truncate"
          >
            <span className="text-red-500 mr-1.5">♥</span>
            {displayName(h)}
          </div>
        ))
      )}
    </div>
  );

  return (
    <Tooltip
      content={popoverContent}
      placement="left"
      appendTo={() => document.body}
      arrow={false}
      theme="freud-popover"
      delay={[150, 0]}
      disabled={count === 0}
    >
      <button
        onClick={onToggle}
        className={`text-lg leading-none px-1 ${
          userHasHearted
            ? "text-red-500"
            : "text-gray-300 hover:text-red-300"
        }`}
        aria-label={
          userHasHearted ? "Remove your heart" : "Heart this dream"
        }
      >
        {userHasHearted || count > 0 ? "♥" : "♡"}
        {count > 0 && (
          <span className="text-xs ml-0.5 text-gray-600 font-medium align-middle">
            {count}
          </span>
        )}
      </button>
    </Tooltip>
  );
}
