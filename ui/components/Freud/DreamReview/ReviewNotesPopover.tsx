import { useState } from "react";
import { gql, useQuery, useMutation } from "urql";
import Tooltip from "@tippyjs/react";
import Avatar from "components/Avatar";
import dayjs from "dayjs";

const COMMENTS_QUERY = gql`
  query DreamReviewComments($bucketId: ID!) {
    dreamReviewComments(bucketId: $bucketId) {
      id
      content
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
  mutation CreateDreamReviewComment($bucketId: ID!, $content: String!) {
    createDreamReviewComment(bucketId: $bucketId, content: $content) {
      id
      content
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
}: {
  bucketId: string;
  bucketTitle: string;
  commentCount: number;
  currentMemberId: string;
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");

  const [commentsResult, reexecuteComments] = useQuery({
    query: COMMENTS_QUERY,
    variables: { bucketId },
    pause: !open,
  });

  const [, createComment] = useMutation(CREATE_COMMENT);
  const [, deleteComment] = useMutation(DELETE_COMMENT);

  const comments = commentsResult.data?.dreamReviewComments ?? [];

  const handleSubmit = async () => {
    if (!input.trim()) return;
    await createComment({ bucketId, content: input.trim() });
    setInput("");
    reexecuteComments({ requestPolicy: "network-only" });
  };

  const handleDelete = async (id: string) => {
    await deleteComment({ id });
    reexecuteComments({ requestPolicy: "network-only" });
  };

  const content = (
    <div className="bg-white border rounded-lg shadow-xl w-[350px] max-h-[400px] flex flex-col">
      <div className="px-3 py-2 border-b">
        <div className="text-xs text-gray-400 truncate">{bucketTitle}</div>
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
              <span className="text-xs text-gray-400 ml-auto">
                {dayjs(comment.createdAt).format("MMM D, YYYY [at] h:mm A")}
              </span>
              {comment.author?.id === currentMemberId && (
                <button
                  onClick={() => handleDelete(comment.id)}
                  className="text-xs text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100"
                >
                  ✕
                </button>
              )}
            </div>
            <div className="text-sm text-gray-700 ml-6">
              {comment.content}
            </div>
          </div>
        ))}
      </div>
      <div className="border-t p-2">
        <div className="flex gap-1">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Reply or @ mention someone"
            className="border rounded px-2 py-1 text-sm flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
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
      content={content}
      interactive
      visible={open}
      onClickOutside={() => setOpen(false)}
      placement="bottom-end"
      appendTo={() => document.body}
      render={(attrs) => <div {...attrs}>{content}</div>}
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
