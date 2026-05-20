import { useState } from "react";
import { gql, useQuery, useMutation } from "urql";
import toast from "react-hot-toast";

const BUCKETS_QUERY = gql`
  query NewTopicFormBuckets($roundId: ID!) {
    dreamReviewTable(roundId: $roundId) {
      bucket {
        id
        title
      }
    }
  }
`;

const CREATE_CONVERSATION = gql`
  mutation CreateConversation(
    $roundId: ID!
    $title: String!
    $bucketIds: [ID!]!
    $initialMessage: String!
  ) {
    createConversation(
      roundId: $roundId
      title: $title
      bucketIds: $bucketIds
      initialMessage: $initialMessage
    ) {
      id
      title
      buckets {
        id
      }
    }
  }
`;

type Props = {
  roundId: string;
  bucket: {
    id: string;
    title: string;
  };
  canEditBucketSelection: boolean;
  onCreated: (conversationId: string) => void;
  onCancel: () => void;
};

export default function NewTopicForm({
  roundId,
  bucket,
  canEditBucketSelection,
  onCreated,
  onCancel,
}: Props) {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [selectedBucketIds, setSelectedBucketIds] = useState<Set<string>>(
    new Set([bucket.id])
  );

  const [bucketsResult] = useQuery({
    query: BUCKETS_QUERY,
    variables: { roundId },
    pause: !canEditBucketSelection,
  });
  const [createResult, createConversation] = useMutation(CREATE_CONVERSATION);

  const allBuckets = bucketsResult.data?.dreamReviewTable ?? [];

  const canSubmit =
    title.trim() && message.trim() && selectedBucketIds.size > 0;

  const handleCreate = async () => {
    if (!canSubmit) return;
    const result = await createConversation({
      roundId,
      title: title.trim(),
      bucketIds: Array.from(selectedBucketIds),
      initialMessage: message.trim(),
    });
    if (result.error) {
      toast.error(result.error.message);
      return;
    }
    toast.success("Conversation created");
    const newId = result.data?.createConversation?.id;
    if (newId) onCreated(newId);
  };

  return (
    <div className="bg-white border rounded-lg p-4 mb-4 space-y-3">
      <input
        type="text"
        placeholder="Conversation title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="border rounded px-3 py-2 w-full text-sm"
      />

      <div>
        <div className="text-sm font-medium mb-1">Dream:</div>
        {canEditBucketSelection ? (
          <div className="max-h-32 overflow-y-auto border rounded p-2 space-y-1">
            {allBuckets.map((d) => (
              <label
                key={d.bucket.id}
                className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 px-1"
              >
                <input
                  type="checkbox"
                  checked={selectedBucketIds.has(d.bucket.id)}
                  onChange={() => {
                    setSelectedBucketIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(d.bucket.id)) next.delete(d.bucket.id);
                      else next.add(d.bucket.id);
                      return next;
                    });
                  }}
                />
                <span className="truncate">{d.bucket.title}</span>
              </label>
            ))}
          </div>
        ) : (
          <div className="inline-flex items-center gap-2 bg-gray-100 border border-gray-200 rounded-full px-3 py-1 text-sm text-gray-700">
            {bucket.title}
          </div>
        )}
      </div>

      <textarea
        placeholder="Initial message..."
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={4}
        className="border rounded px-3 py-2 w-full text-sm"
      />

      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded text-sm text-gray-600 hover:bg-gray-100"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleCreate}
          disabled={!canSubmit || createResult.fetching}
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm disabled:opacity-50"
        >
          Create Conversation
        </button>
      </div>
    </div>
  );
}
