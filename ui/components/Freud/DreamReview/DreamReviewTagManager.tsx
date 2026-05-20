import { useState } from "react";
import { gql, useMutation } from "urql";

const CREATE_TAG = gql`
  mutation CreateDreamReviewTag($roundId: ID!, $value: String!, $color: String) {
    createDreamReviewTag(roundId: $roundId, value: $value, color: $color) {
      id
      value
      color
    }
  }
`;

const DELETE_TAG = gql`
  mutation DeleteDreamReviewTag($id: ID!) {
    deleteDreamReviewTag(id: $id) {
      id
    }
  }
`;

const TAG_COLORS = [
  "#6B7280", "#EF4444", "#F59E0B", "#10B981", "#3B82F6",
  "#8B5CF6", "#EC4899", "#14B8A6", "#F97316", "#6366F1",
];

export default function DreamReviewTagManager({
  roundId,
  tags,
  open,
  onClose,
}: {
  roundId: string;
  tags: { id: string; value: string; color: string }[];
  open: boolean;
  onClose: () => void;
}) {
  const [newValue, setNewValue] = useState("");
  const [newColor, setNewColor] = useState(TAG_COLORS[0]);
  const [, createTag] = useMutation(CREATE_TAG);
  const [, deleteTag] = useMutation(DELETE_TAG);

  if (!open) return null;

  const handleCreate = async () => {
    if (!newValue.trim()) return;
    await createTag({ roundId, value: newValue.trim(), color: newColor });
    setNewValue("");
  };

  const handleDelete = async (id: string) => {
    await deleteTag({ id });
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-lg">Manage Review Tags</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            ✕
          </button>
        </div>

        <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
          {tags.map((tag) => (
            <div key={tag.id} className="flex items-center gap-2">
              <span
                className="w-4 h-4 rounded-full flex-shrink-0"
                style={{ backgroundColor: tag.color }}
              />
              <span className="flex-1 text-sm">{tag.value}</span>
              <button
                onClick={() => handleDelete(tag.id)}
                className="text-xs text-red-500 hover:text-red-700"
              >
                Delete
              </button>
            </div>
          ))}
          {tags.length === 0 && (
            <div className="text-sm text-gray-400">No tags yet</div>
          )}
        </div>

        <div className="border-t pt-3">
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              placeholder="New tag name..."
              className="border rounded px-2 py-1 text-sm flex-1"
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
            <button
              onClick={handleCreate}
              disabled={!newValue.trim()}
              className="bg-blue-600 text-white px-3 py-1 rounded text-sm disabled:opacity-50"
            >
              Add
            </button>
          </div>
          <div className="flex gap-1">
            {TAG_COLORS.map((color) => (
              <button
                key={color}
                onClick={() => setNewColor(color)}
                className={`w-6 h-6 rounded-full border-2 ${
                  newColor === color ? "border-gray-800" : "border-transparent"
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
