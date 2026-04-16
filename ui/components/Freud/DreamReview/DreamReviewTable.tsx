import { useMemo, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
} from "@mui/material";
import { gql, useMutation } from "urql";
import { FormattedNumber } from "react-intl";
import DreamReviewTagCell from "./DreamReviewTagCell";
import ReviewerCell from "./ReviewerCell";
import ReviewNotesPopover from "./ReviewNotesPopover";
import DreamReviewTagManager from "./DreamReviewTagManager";
import Link from "next/link";

const APPROVE_BUCKET = gql`
  mutation ApproveForGranting($bucketId: ID!, $approved: Boolean!) {
    approveForGranting(bucketId: $bucketId, approved: $approved) {
      id
      approved
    }
  }
`;

const ADD_REVIEWER = gql`
  mutation AddDreamReviewer($bucketId: ID!, $reviewerId: ID!) {
    addDreamReviewer(bucketId: $bucketId, reviewerId: $reviewerId) {
      id
      reviewer {
        id
        user { id username name }
      }
    }
  }
`;

const REMOVE_REVIEWER = gql`
  mutation RemoveDreamReviewer($bucketId: ID!, $reviewerId: ID!) {
    removeDreamReviewer(bucketId: $bucketId, reviewerId: $reviewerId)
  }
`;

type SortField =
  | "dream"
  | "tag"
  | "progress"
  | "funders"
  | "funded"
  | "goal"
  | "stretch"
  | "reviewedBy"
  | "assignedTo"
  | "cocreators"
  | "approved"
  | "notes";
type SortDir = "asc" | "desc";

function getSortValue(d: any, field: SortField): string | number {
  switch (field) {
    case "dream":
      return d.bucket.title.toLowerCase();
    case "tag":
      return d.dreamReviewTags.map((t) => t.value).sort().join(",").toLowerCase();
    case "progress":
      return d.goal > 0 ? d.funded / d.goal : 0;
    case "funders":
      return d.funders || 0;
    case "funded":
      return d.funded;
    case "goal":
      return d.goal;
    case "stretch":
      return d.stretch;
    case "reviewedBy":
      return d.reviewedBy.length;
    case "assignedTo":
      return (d.assignedTo || []).length;
    case "cocreators":
      return (d.bucket.cocreators || []).length;
    case "approved":
      return d.bucket.approved ? 1 : 0;
    case "notes":
      return d.reviewCommentCount;
    default:
      return 0;
  }
}

interface DreamReviewTableProps {
  bucketData: any[];
  allTags: any[];
  allMembers: any[];
  adminModMembers: any[];
  currentMemberId: string;
  roundId: string;
  roundSlug: string;
  groupSlug: string;
  currency: string;
}

export default function DreamReviewTable({
  bucketData,
  allTags,
  allMembers,
  adminModMembers,
  currentMemberId,
  roundId,
  roundSlug,
  groupSlug,
  currency,
}: DreamReviewTableProps) {
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState<string>("");
  const [reviewFilter, setReviewFilter] = useState<string>("");
  const [approvedFilter, setApprovedFilter] = useState<string>("");
  const [publishedFilter, setPublishedFilter] = useState<string>("");
  const [tagManagerOpen, setTagManagerOpen] = useState(false);
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [, approveBucket] = useMutation(APPROVE_BUCKET);
  const [, addReviewer] = useMutation(ADD_REVIEWER);
  const [, removeReviewer] = useMutation(REMOVE_REVIEWER);

  const hasActiveFilters = search || tagFilter || reviewFilter || approvedFilter || publishedFilter;

  const clearAllFilters = () => {
    setSearch("");
    setTagFilter("");
    setReviewFilter("");
    setApprovedFilter("");
    setPublishedFilter("");
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDir === "asc") {
        setSortDir("desc");
      } else {
        // Third click clears sort
        setSortField(null);
        setSortDir("asc");
      }
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const filtered = useMemo(() => {
    let result = bucketData;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((d) =>
        d.bucket.title.toLowerCase().includes(q)
      );
    }
    if (tagFilter) {
      result = result.filter((d) =>
        d.dreamReviewTags.some((t) => t.id === tagFilter)
      );
    }
    if (reviewFilter === "unreviewed") {
      result = result.filter((d) => d.reviewedBy.length === 0);
    }
    if (approvedFilter === "yes") {
      result = result.filter((d) => !!d.bucket.approved);
    } else if (approvedFilter === "no") {
      result = result.filter((d) => !d.bucket.approved);
    }
    if (publishedFilter === "yes") {
      result = result.filter((d) => !!d.bucket.published);
    } else if (publishedFilter === "no") {
      result = result.filter((d) => !d.bucket.published);
    }
    if (sortField) {
      result = [...result].sort((a, b) => {
        const aVal = getSortValue(a, sortField);
        const bVal = getSortValue(b, sortField);
        let cmp = 0;
        if (typeof aVal === "string" && typeof bVal === "string") {
          cmp = aVal.localeCompare(bVal);
        } else {
          cmp = (aVal as number) - (bVal as number);
        }
        return sortDir === "desc" ? -cmp : cmp;
      });
    }
    return result;
  }, [bucketData, search, tagFilter, reviewFilter, approvedFilter, publishedFilter, sortField, sortDir]);

  const sortableHeader = (field: SortField, label: string, align?: "right" | "center") => (
    <TableCell
      className={`!font-semibold !text-xs !text-gray-500 ${
        align === "right" ? "!text-right" : align === "center" ? "!text-center" : ""
      }`}
      sortDirection={sortField === field ? sortDir : false}
    >
      <TableSortLabel
        active={sortField === field}
        direction={sortField === field ? sortDir : "asc"}
        onClick={() => handleSort(field)}
        className="!text-xs"
      >
        {label}
      </TableSortLabel>
    </TableCell>
  );

  return (
    <>
      <DreamReviewTagManager
        roundId={roundId}
        tags={allTags}
        open={tagManagerOpen}
        onClose={() => setTagManagerOpen(false)}
      />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <input
          type="text"
          placeholder="Search dreams..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border rounded px-2 py-1 text-sm w-48"
        />
        <select
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value)}
          className="border rounded px-2 py-1 text-sm"
        >
          <option value="">All tags</option>
          {allTags.map((t) => (
            <option key={t.id} value={t.id}>
              {t.value}
            </option>
          ))}
        </select>
        <select
          value={reviewFilter}
          onChange={(e) => setReviewFilter(e.target.value)}
          className="border rounded px-2 py-1 text-sm"
        >
          <option value="">All dreams</option>
          <option value="unreviewed">Unreviewed only</option>
        </select>
        <select
          value={approvedFilter}
          onChange={(e) => setApprovedFilter(e.target.value)}
          className="border rounded px-2 py-1 text-sm"
        >
          <option value="">Approved: All</option>
          <option value="yes">Approved</option>
          <option value="no">Not approved</option>
        </select>
        <select
          value={publishedFilter}
          onChange={(e) => setPublishedFilter(e.target.value)}
          className="border rounded px-2 py-1 text-sm"
        >
          <option value="">Published: All</option>
          <option value="yes">Published</option>
          <option value="no">Unpublished</option>
        </select>
        {hasActiveFilters && (
          <button
            onClick={clearAllFilters}
            className="text-sm text-red-500 hover:text-red-700"
            title="Clear all filters"
          >
            ✕ Clear
          </button>
        )}
        <button
          onClick={() => setTagManagerOpen(true)}
          className="text-sm text-gray-500 hover:text-gray-700 ml-auto"
          title="Manage tags"
        >
          ⚙ Tags
        </button>
      </div>

      {/* Table */}
      <TableContainer className="overflow-x-auto">
        <Table size="small" className="min-w-[1200px]">
          <TableHead>
            <TableRow>
              <TableCell className="!font-semibold !text-xs !text-gray-500 w-8">
                #
              </TableCell>
              {sortableHeader("dream", "Dream")}
              {sortableHeader("tag", "Tag")}
              {sortableHeader("progress", "Progress", "right")}
              {sortableHeader("funders", "Funders", "right")}
              {sortableHeader("funded", "Funded", "right")}
              {sortableHeader("goal", "Goal", "right")}
              {sortableHeader("stretch", "Stretch", "right")}
              {sortableHeader("reviewedBy", "Reviewed By")}
              {sortableHeader("assignedTo", "Assigned To")}
              {sortableHeader("cocreators", "Cocreators")}
              {sortableHeader("approved", "Approved", "center")}
              {sortableHeader("notes", "Notes", "center")}
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map((d, idx) => {
              const progressPct = d.goal > 0 ? (d.funded / d.goal) * 100 : 0;
              const isApproved = !!d.bucket.approved;

              return (
                <TableRow
                  key={d.bucket.id}
                  className="hover:bg-gray-50"
                >
                  <TableCell className="!text-xs !text-gray-400">
                    {idx + 1}
                  </TableCell>
                  <TableCell className="!text-sm !font-medium max-w-[200px]">
                    <Link
                      href={`/${groupSlug}/${roundSlug}/${d.bucket.id}`}
                      className="hover:underline text-blue-700 truncate block"
                    >
                      {d.bucket.title}
                    </Link>
                  </TableCell>
                  <TableCell className="!py-1">
                    <DreamReviewTagCell
                      bucketId={d.bucket.id}
                      assignedTags={d.dreamReviewTags}
                      allTags={allTags}
                    />
                  </TableCell>
                  <TableCell className="!text-sm !text-right">
                    <span
                      className={
                        progressPct >= 100
                          ? "text-green-600 font-medium"
                          : progressPct > 0
                          ? "text-amber-600"
                          : "text-gray-400"
                      }
                    >
                      {d.goal > 0 ? `${Math.round(progressPct)}%` : "—"}
                    </span>
                  </TableCell>
                  <TableCell className="!text-sm !text-right">
                    {d.funders || 0}
                  </TableCell>
                  <TableCell className="!text-sm !text-right">
                    <FormattedNumber
                      value={d.funded}
                      style="decimal"
                      maximumFractionDigits={0}
                    />
                  </TableCell>
                  <TableCell className="!text-sm !text-right">
                    <FormattedNumber
                      value={d.goal}
                      style="decimal"
                      maximumFractionDigits={0}
                    />
                  </TableCell>
                  <TableCell className="!text-sm !text-right">
                    <FormattedNumber
                      value={d.stretch}
                      style="decimal"
                      maximumFractionDigits={0}
                    />
                  </TableCell>
                  <TableCell className="!py-1">
                    <ReviewerCell
                      reviewedBy={d.reviewedBy}
                    />
                  </TableCell>
                  <TableCell className="!py-1">
                    <AssignedToCell
                      bucketId={d.bucket.id}
                      assignedTo={d.assignedTo || []}
                      adminModMembers={adminModMembers}
                      onAdd={(reviewerId) => addReviewer({ bucketId: d.bucket.id, reviewerId })}
                      onRemove={(reviewerId) => removeReviewer({ bucketId: d.bucket.id, reviewerId })}
                    />
                  </TableCell>
                  <TableCell className="!py-1">
                    <div className="flex flex-wrap gap-1">
                      {d.bucket.cocreators?.map((cc) => (
                        <span
                          key={cc.id}
                          className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-xs"
                        >
                          {cc.user?.username || cc.user?.name || "?"}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="!text-center">
                    <input
                      type="checkbox"
                      checked={isApproved}
                      onChange={() =>
                        approveBucket({
                          bucketId: d.bucket.id,
                          approved: !isApproved,
                        })
                      }
                      className="cursor-pointer"
                    />
                  </TableCell>
                  <TableCell className="!text-center">
                    <ReviewNotesPopover
                      bucketId={d.bucket.id}
                      bucketTitle={d.bucket.title}
                      commentCount={d.reviewCommentCount}
                      currentMemberId={currentMemberId}
                      adminModMembers={adminModMembers}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={13} className="!text-center !text-gray-400 !py-8">
                  {bucketData.length === 0
                    ? "No dreams in this round yet"
                    : "No dreams match the current filters"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </>
  );
}

function AssignedToCell({
  bucketId,
  assignedTo,
  adminModMembers,
  onAdd,
  onRemove,
}: {
  bucketId: string;
  assignedTo: any[];
  adminModMembers: any[];
  onAdd: (reviewerId: string) => void;
  onRemove: (reviewerId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const assignedIds = new Set(assignedTo.map((m) => m.id));

  const handleToggle = (member: any) => {
    if (assignedIds.has(member.id)) {
      onRemove(member.id);
    } else {
      onAdd(member.id);
    }
  };

  const label = assignedTo.length > 0
    ? assignedTo.map((m) => m.user?.username || m.user?.name || "?").join(", ")
    : "—";

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="text-xs text-left truncate max-w-[140px] hover:text-blue-600"
        title={label}
      >
        {label}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1 bg-white border rounded shadow-lg py-1 min-w-[160px] max-h-48 overflow-y-auto">
            {adminModMembers.map((m) => (
              <label
                key={m.id}
                className="flex items-center gap-2 px-3 py-1 hover:bg-gray-50 cursor-pointer text-xs"
              >
                <input
                  type="checkbox"
                  checked={assignedIds.has(m.id)}
                  onChange={() => handleToggle(m)}
                />
                {m.user?.username || m.user?.name || "?"}
              </label>
            ))}
            {adminModMembers.length === 0 && (
              <div className="px-3 py-1 text-xs text-gray-400">No admins/mods</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
