import { useState, useRef, useMemo } from "react";
import { gql, useQuery, useMutation } from "urql";
import Tooltip from "@tippyjs/react";
import Avatar from "components/Avatar";
import dayjs from "dayjs";

const COMMENTS_QUERY = gql`
  query DreamReviewComments($bucketId: ID!) {
    dreamReviewComments(bucketId: $bucketId) {
      id
      content
      verdict
      createdAt
      author {
        id
        user {
          id
          username
          name
        }
      }
    }
  }
`;

const CREATE_COMMENT = gql`
  mutation CreateDreamReviewComment($bucketId: ID!, $content: String!, $verdict: String) {
    createDreamReviewComment(bucketId: $bucketId, content: $content, verdict: $verdict) {
      id
    }
  }
`;

const EDIT_COMMENT = gql`
  mutation EditDreamReviewComment($id: ID!, $content: String!, $verdict: String) {
    editDreamReviewComment(id: $id, content: $content, verdict: $verdict) {
      id
    }
  }
`;

const DELETE_COMMENT = gql`
  mutation DeleteDreamReviewComment($id: ID!) {
    deleteDreamReviewComment(id: $id)
  }
`;

export default function ReviewNotesPopover({
  bucketId,
  bucketTitle,
  commentCount,
  currentMemberId,
  adminModMembers,
}: {
  bucketId: string;
  bucketTitle: string;
  commentCount: number;
  currentMemberId: string;
  adminModMembers?: { id: string; user: any }[];
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [verdict, setVerdict] = useState<string>("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editVerdict, setEditVerdict] = useState<string>("");
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const [commentsResult, reexecuteComments] = useQuery({
    query: COMMENTS_QUERY,
    variables: { bucketId },
    pause: !open,
  });

  const [, createComment] = useMutation(CREATE_COMMENT);
  const [, editComment] = useMutation(EDIT_COMMENT);
  const [, deleteComment] = useMutation(DELETE_COMMENT);

  const comments = commentsResult.data?.dreamReviewComments ?? [];

  const filteredMembers = useMemo(() => {
    if (!adminModMembers) return [];
    if (!mentionFilter) return adminModMembers;
    const q = mentionFilter.toLowerCase();
    return adminModMembers.filter(
      (m) =>
        m.user?.username?.toLowerCase().includes(q) ||
        m.user?.name?.toLowerCase().includes(q)
    );
  }, [adminModMembers, mentionFilter]);

  const handleInputChange = (value: string) => {
    setInput(value);
    // Check for @-mention trigger
    const lastAt = value.lastIndexOf("@");
    if (lastAt >= 0) {
      const afterAt = value.slice(lastAt + 1);
      if (!afterAt.includes(" ") && afterAt.length < 20) {
        setShowMentions(true);
        setMentionFilter(afterAt);
        return;
      }
    }
    setShowMentions(false);
    setMentionFilter("");
  };

  const insertMention = (username: string) => {
    const lastAt = input.lastIndexOf("@");
    if (lastAt >= 0) {
      setInput(input.slice(0, lastAt) + `@${username} `);
    }
    setShowMentions(false);
    setMentionFilter("");
    inputRef.current?.focus();
  };

  const handleSubmit = async () => {
    if (!input.trim()) return;
    await createComment({
      bucketId,
      content: input.trim(),
      verdict: verdict || null,
    });
    setInput("");
    setVerdict("");
    setShowMentions(false);
    reexecuteComments({ requestPolicy: "network-only" });
  };

  const handleEdit = async (id: string) => {
    if (!editContent.trim()) return;
    await editComment({
      id,
      content: editContent.trim(),
      verdict: editVerdict || null,
    });
    setEditingId(null);
    setEditContent("");
    setEditVerdict("");
    reexecuteComments({ requestPolicy: "network-only" });
  };

  const handleDelete = async (id: string) => {
    await deleteComment({ id });
    reexecuteComments({ requestPolicy: "network-only" });
  };

  // Render @mentions as bold in comment text
  const renderContent = (text: string) => {
    return text.replace(/@(\w+)/g, '<strong>@$1</strong>');
  };

  const verdictLabel = (v: string | null) => {
    if (v === "pass") return "✅ Pass";
    if (v === "flag") return "❌ Flag";
    return null;
  };

  const popoverContent = (
    <div
      className="bg-white border rounded-lg shadow-xl w-[350px] max-h-[400px] flex flex-col"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          setOpen(false);
        }
      }}
    >
      <div className="px-3 py-2 border-b flex items-center gap-2">
        <div className="text-xs text-gray-400 truncate flex-1">
          {bucketTitle}
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close notes"
          className="text-gray-400 hover:text-gray-700 leading-none text-lg px-1"
        >
          ×
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {commentsResult.fetching && (
          <div className="text-xs text-gray-400 text-center py-4">
            Loading...
          </div>
        )}
        {!commentsResult.fetching && comments.length === 0 && (
          <div className="text-xs text-gray-400 text-center py-4">
            No notes yet
          </div>
        )}
        {comments.map((comment) => (
          <div key={comment.id} className="group">
            <div className="flex items-center gap-2 mb-0.5">
              <Avatar user={comment.author?.user} size="xs" />
              <span className="text-xs font-medium">
                {comment.author?.user?.name ||
                  comment.author?.user?.username}
              </span>
              {verdictLabel(comment.verdict) && (
                <span className="text-xs">{verdictLabel(comment.verdict)}</span>
              )}
              <span className="text-xs text-gray-400 ml-auto">
                {dayjs(comment.createdAt).format("MMM D, YYYY [at] h:mm A")}
              </span>
              {comment.author?.id === currentMemberId && (
                <span className="flex gap-1 opacity-0 group-hover:opacity-100">
                  <button
                    onClick={() => {
                      setEditingId(comment.id);
                      setEditContent(comment.content);
                      setEditVerdict(comment.verdict || "");
                    }}
                    className="text-xs text-blue-400 hover:text-blue-600"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(comment.id)}
                    className="text-xs text-red-400 hover:text-red-600"
                  >
                    ✕
                  </button>
                </span>
              )}
            </div>
            {editingId === comment.id ? (
              <div className="ml-6 space-y-1">
                <input
                  type="text"
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="border rounded px-2 py-0.5 text-xs w-full"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleEdit(comment.id);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                />
                <div className="flex items-center gap-1">
                  <select
                    value={editVerdict}
                    onChange={(e) => setEditVerdict(e.target.value)}
                    className="border rounded px-1 py-0.5 text-xs"
                  >
                    <option value="">No verdict</option>
                    <option value="pass">✅ Pass</option>
                    <option value="flag">❌ Flag</option>
                  </select>
                  <button
                    onClick={() => handleEdit(comment.id)}
                    className="text-xs text-blue-600 ml-auto"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="text-xs text-gray-400"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div
                className="text-sm text-gray-700 ml-6"
                dangerouslySetInnerHTML={{
                  __html: renderContent(comment.content),
                }}
              />
            )}
          </div>
        ))}
      </div>
      <div className="border-t p-2 relative">
        {showMentions && filteredMembers.length > 0 && (
          <div className="absolute bottom-full left-2 right-2 bg-white border rounded shadow-lg max-h-32 overflow-y-auto mb-1">
            {filteredMembers.map((m) => (
              <button
                key={m.id}
                onClick={() =>
                  insertMention(m.user?.username || m.user?.name || "")
                }
                className="flex items-center gap-2 w-full px-2 py-1 text-xs hover:bg-blue-50 text-left"
              >
                <Avatar user={m.user} size="xs" />
                <span>
                  {m.user?.name || m.user?.username}
                </span>
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-1 items-center">
          <select
            value={verdict}
            onChange={(e) => setVerdict(e.target.value)}
            className="border rounded px-1 py-1 text-xs w-20"
          >
            <option value="">—</option>
            <option value="pass">✅ Pass</option>
            <option value="flag">❌ Flag</option>
          </select>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder="Add a note..."
            className="border rounded px-2 py-1 text-sm flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !showMentions) {
                e.preventDefault();
                handleSubmit();
              }
              if (e.key === "Escape") {
                setShowMentions(false);
              }
            }}
          />
          <button
            onClick={handleSubmit}
            disabled={!input.trim()}
            className="bg-blue-600 text-white px-2 py-1 rounded text-xs disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <Tooltip
      content={popoverContent}
      interactive
      visible={open}
      onClickOutside={() => setOpen(false)}
      placement="bottom-end"
      appendTo={() => document.body}
      arrow={false}
      theme="freud-popover"
    >
      <button
        onClick={() => setOpen(!open)}
        className={`inline-flex items-center justify-center min-w-[20px] min-h-[20px] rounded-full text-xs font-medium ${
          commentCount > 0
            ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
            : "text-gray-300 hover:text-gray-500 hover:bg-gray-100"
        }`}
      >
        {commentCount > 0 ? commentCount : "+"}
      </button>
    </Tooltip>
  );
}
