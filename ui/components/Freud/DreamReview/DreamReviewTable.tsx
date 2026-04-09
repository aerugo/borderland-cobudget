import { useMemo, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import { gql, useMutation } from "urql";
import { FormattedNumber } from "react-intl";
import DreamReviewTagCell from "./DreamReviewTagCell";
import ReviewerCell from "./ReviewerCell";
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

interface DreamReviewTableProps {
  bucketData: any[];
  allTags: any[];
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
  const [tagManagerOpen, setTagManagerOpen] = useState(false);
  const [, approveBucket] = useMutation(APPROVE_BUCKET);

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
    return result;
  }, [bucketData, search, tagFilter, reviewFilter]);

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
              <TableCell className="!font-semibold !text-xs !text-gray-500">
                Dream
              </TableCell>
              <TableCell className="!font-semibold !text-xs !text-gray-500">
                Tag
              </TableCell>
              <TableCell className="!font-semibold !text-xs !text-gray-500 !text-right">
                Progress
              </TableCell>
              <TableCell className="!font-semibold !text-xs !text-gray-500 !text-right">
                Funders
              </TableCell>
              <TableCell className="!font-semibold !text-xs !text-gray-500 !text-right">
                Funded
              </TableCell>
              <TableCell className="!font-semibold !text-xs !text-gray-500 !text-right">
                Goal
              </TableCell>
              <TableCell className="!font-semibold !text-xs !text-gray-500 !text-right">
                Stretch
              </TableCell>
              <TableCell className="!font-semibold !text-xs !text-gray-500">
                Reviewed By
              </TableCell>
              <TableCell className="!font-semibold !text-xs !text-gray-500">
                Cocreators
              </TableCell>
              <TableCell className="!font-semibold !text-xs !text-gray-500 !text-center">
                Approved
              </TableCell>
              <TableCell className="!font-semibold !text-xs !text-gray-500 !text-center">
                Notes
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map((d, idx) => {
              const progressPct = d.goal > 0 ? (d.funded / d.goal) * 100 : 0;
              const isApproved = !!d.bucket.approvedAt;

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
                      bucketId={d.bucket.id}
                      reviewedBy={d.reviewedBy}
                      adminModMembers={adminModMembers}
                      currentMemberId={currentMemberId}
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
                    {d.reviewCommentCount > 0 && (
                      <span className="inline-flex items-center justify-center w-5 h-5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                        {d.reviewCommentCount}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={12} className="!text-center !text-gray-400 !py-8">
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
