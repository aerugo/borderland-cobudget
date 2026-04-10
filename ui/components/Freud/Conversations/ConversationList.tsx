import { useState, useMemo, useRef, useEffect } from "react";
import { gql, useQuery, useMutation } from "urql";
import Link from "next/link";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { CardListSkeleton } from "../LoadingSkeleton";
import toast from "react-hot-toast";

dayjs.extend(relativeTime);

const CONVERSATIONS_QUERY = gql`
  query Conversations($roundId: ID!) {
    conversations(roundId: $roundId) {
      id
      title
      messageCount
      createdAt
      lastMessageAt
      buckets {
        id
        title
      }
      createdBy {
        id
        user {
          id
          username
          name
        }
      }
      messages {
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
  }
`;

const BUCKETS_QUERY = gql`
  query ConvBuckets($roundId: ID!) {
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

export default function ConversationList({
  round,
  groupSlug,
  roundSlug,
}: {
  round: any;
  groupSlug: string;
  roundSlug: string;
}) {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [selectedBucketIds, setSelectedBucketIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [bucketFilterIds, setBucketFilterIds] = useState<Set<string>>(
    new Set()
  );
  const [dreamFilterOpen, setDreamFilterOpen] = useState(false);
  const [dreamFilterQuery, setDreamFilterQuery] = useState("");
  const dreamFilterRef = useRef<HTMLDivElement>(null);
  const [sortBy, setSortBy] = useState<
    "recent" | "oldest" | "titleAsc" | "titleDesc" | "dreamAsc" | "dreamDesc"
  >("recent");

  useEffect(() => {
    if (!dreamFilterOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (
        dreamFilterRef.current &&
        !dreamFilterRef.current.contains(e.target as Node)
      ) {
        setDreamFilterOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [dreamFilterOpen]);

  const [convResult] = useQuery({
    query: CONVERSATIONS_QUERY,
    variables: { roundId: round.id },
  });
  const [bucketsResult] = useQuery({
    query: BUCKETS_QUERY,
    variables: { roundId: round.id },
  });
  const [, createConversation] = useMutation(CREATE_CONVERSATION);

  const conversations = convResult.data?.conversations ?? [];
  const allBuckets = bucketsResult.data?.dreamReviewTable ?? [];

  const bucketById = useMemo(() => {
    const map = new Map<string, { id: string; title: string }>();
    for (const d of allBuckets) map.set(d.bucket.id, d.bucket);
    return map;
  }, [allBuckets]);

  const dreamFilterMatches = useMemo(() => {
    const q = dreamFilterQuery.trim().toLowerCase();
    const list = q
      ? allBuckets.filter((d) =>
          d.bucket.title?.toLowerCase().includes(q)
        )
      : allBuckets;
    return list.slice(0, 50);
  }, [allBuckets, dreamFilterQuery]);

  const filteredConversations = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = conversations.filter((conv) => {
      if (
        bucketFilterIds.size > 0 &&
        !conv.buckets.some((b) => bucketFilterIds.has(b.id))
      ) {
        return false;
      }
      if (!q) return true;
      if (conv.title?.toLowerCase().includes(q)) return true;
      if (conv.buckets.some((b) => b.title?.toLowerCase().includes(q))) {
        return true;
      }
      if (
        conv.messages?.some((m) => m.content?.toLowerCase().includes(q))
      ) {
        return true;
      }
      return false;
    });

    const dreamLabel = (conv) =>
      (conv.buckets?.[0]?.title ?? "").toLowerCase();
    const title = (conv) => (conv.title ?? "").toLowerCase();
    const lastTs = (conv) => {
      const v = conv.lastMessageAt ?? conv.createdAt;
      return v ? new Date(v).getTime() : 0;
    };

    const sorted = [...filtered];
    switch (sortBy) {
      case "recent":
        sorted.sort((a, b) => lastTs(b) - lastTs(a));
        break;
      case "oldest":
        sorted.sort((a, b) => lastTs(a) - lastTs(b));
        break;
      case "titleAsc":
        sorted.sort((a, b) => title(a).localeCompare(title(b)));
        break;
      case "titleDesc":
        sorted.sort((a, b) => title(b).localeCompare(title(a)));
        break;
      case "dreamAsc":
        sorted.sort((a, b) => dreamLabel(a).localeCompare(dreamLabel(b)));
        break;
      case "dreamDesc":
        sorted.sort((a, b) => dreamLabel(b).localeCompare(dreamLabel(a)));
        break;
    }
    return sorted;
  }, [conversations, search, bucketFilterIds, sortBy]);

  const toggleBucketFilter = (id: string) => {
    setBucketFilterIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreate = async () => {
    if (!title.trim() || !message.trim() || selectedBucketIds.size === 0) return;
    const result = await createConversation({
      roundId: round.id,
      title: title.trim(),
      bucketIds: Array.from(selectedBucketIds),
      initialMessage: message.trim(),
    });
    if (result.error) {
      toast.error(result.error.message);
    } else {
      toast.success("Conversation created");
      setShowForm(false);
      setTitle("");
      setMessage("");
      setSelectedBucketIds(new Set());
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-lg">Conversations</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm"
        >
          {showForm ? "Cancel" : "New Conversation"}
        </button>
      </div>

      {/* New Conversation Form */}
      {showForm && (
        <div className="bg-white border rounded-lg p-4 mb-4 space-y-3">
          <input
            type="text"
            placeholder="Conversation title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="border rounded px-3 py-2 w-full text-sm"
          />
          <div>
            <div className="text-sm font-medium mb-1">Link to dreams:</div>
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
          </div>
          <textarea
            placeholder="Initial message..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            className="border rounded px-3 py-2 w-full text-sm"
          />
          <button
            onClick={handleCreate}
            disabled={!title.trim() || !message.trim() || selectedBucketIds.size === 0}
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm disabled:opacity-50"
          >
            Create Conversation
          </button>
        </div>
      )}

      {/* Search + filter */}
      {!convResult.fetching && conversations.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-2 mb-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations..."
            className="border rounded px-3 py-2 text-sm flex-1 min-w-0"
          />
          <div
            ref={dreamFilterRef}
            className="relative flex-1 min-w-0 sm:max-w-[320px]"
          >
            <div
              className="flex flex-wrap items-center gap-1 border rounded px-2 py-1 min-h-[38px] bg-white cursor-text"
              onClick={() => {
                setDreamFilterOpen(true);
              }}
            >
              {Array.from(bucketFilterIds).map((id) => {
                const bucket = bucketById.get(id);
                const label = bucket?.title ?? "Unknown";
                return (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded"
                  >
                    <span className="truncate max-w-[140px]">{label}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleBucketFilter(id);
                      }}
                      aria-label={`Remove ${label}`}
                      className="text-blue-600 hover:text-blue-900 leading-none"
                    >
                      ×
                    </button>
                  </span>
                );
              })}
              <input
                type="text"
                value={dreamFilterQuery}
                onChange={(e) => {
                  setDreamFilterQuery(e.target.value);
                  setDreamFilterOpen(true);
                }}
                onFocus={() => setDreamFilterOpen(true)}
                onKeyDown={(e) => {
                  if (
                    e.key === "Backspace" &&
                    dreamFilterQuery === "" &&
                    bucketFilterIds.size > 0
                  ) {
                    const last = Array.from(bucketFilterIds).pop()!;
                    toggleBucketFilter(last);
                  } else if (e.key === "Escape") {
                    setDreamFilterOpen(false);
                  }
                }}
                placeholder={
                  bucketFilterIds.size === 0 ? "Filter by dream..." : ""
                }
                className="flex-1 min-w-[120px] text-sm outline-none bg-transparent"
              />
            </div>
            {dreamFilterOpen && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white border rounded shadow-lg max-h-60 overflow-y-auto z-20">
                {dreamFilterMatches.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-gray-400">
                    No matching dreams
                  </div>
                ) : (
                  dreamFilterMatches.map((d) => {
                    const selected = bucketFilterIds.has(d.bucket.id);
                    return (
                      <button
                        type="button"
                        key={d.bucket.id}
                        onClick={() => {
                          toggleBucketFilter(d.bucket.id);
                          setDreamFilterQuery("");
                        }}
                        className={`flex w-full items-center gap-2 px-3 py-1.5 text-sm text-left hover:bg-blue-50 ${
                          selected ? "bg-blue-50/60" : ""
                        }`}
                      >
                        <span
                          className={`inline-block w-4 text-blue-600 ${
                            selected ? "" : "invisible"
                          }`}
                        >
                          ✓
                        </span>
                        <span className="truncate">{d.bucket.title}</span>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="border rounded px-3 py-2 text-sm bg-white sm:max-w-[200px]"
            aria-label="Sort conversations"
          >
            <option value="recent">Sort: Latest activity</option>
            <option value="oldest">Sort: Oldest activity</option>
            <option value="titleAsc">Sort: Subject A–Z</option>
            <option value="titleDesc">Sort: Subject Z–A</option>
            <option value="dreamAsc">Sort: Dream A–Z</option>
            <option value="dreamDesc">Sort: Dream Z–A</option>
          </select>
          {(search || bucketFilterIds.size > 0 || sortBy !== "recent") && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setBucketFilterIds(new Set());
                setDreamFilterQuery("");
                setSortBy("recent");
              }}
              className="text-sm text-gray-500 hover:text-gray-700 px-2"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* Conversation List */}
      {convResult.fetching ? (
        <CardListSkeleton count={3} />
      ) : conversations.length === 0 ? (
        <div className="text-center text-gray-400 py-8">
          No conversations yet. Start one to reach out to dreamers.
        </div>
      ) : filteredConversations.length === 0 ? (
        <div className="text-center text-gray-400 py-8">
          No conversations match your search.
        </div>
      ) : (
        <div className="space-y-2">
          {(search || bucketFilterIds.size > 0) && (
            <div className="text-xs text-gray-400 mb-1">
              Showing {filteredConversations.length} of {conversations.length}
            </div>
          )}
          {filteredConversations.map((conv) => {
            const lastMsg = conv.messages?.[0];
            return (
              <Link
                key={conv.id}
                href={`/${groupSlug}/${roundSlug}/freud/conversations/${conv.id}`}
                className="block bg-white border rounded-lg p-4 hover:border-blue-300 transition-colors"
              >
                <div className="font-medium text-sm">{conv.title}</div>
                <div className="text-xs text-gray-500 mt-1">
                  Dreams:{" "}
                  {conv.buckets.map((b) => b.title).join(", ")}
                </div>
                {lastMsg && (
                  <div className="text-xs text-gray-400 mt-1">
                    Last message: {dayjs(lastMsg.createdAt).fromNow()} by{" "}
                    {lastMsg.author?.user?.name || lastMsg.author?.user?.username}
                    {" · "}
                    {conv.messageCount ?? conv.messages?.length} message
                    {(conv.messageCount ?? conv.messages?.length) !== 1 ? "s" : ""}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
