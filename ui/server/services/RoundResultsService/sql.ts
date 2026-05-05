import prisma from "../../prisma";
import { BucketResultRow, RoundResultsPayload } from "./types";

type RawBucketRow = {
  id: string;
  title: string;
  min_goal: string | number | null;
  max_goal: string | number | null;
  contributions_count: string | number;
  contributions_sum: string | number;
  contributors_count: string | number;
  contributions_count_funded: string | number;
  contributions_sum_funded: string | number;
};

type RawRow = {
  totals: { total_contrib_count: number; total_contrib_amount: string | number };
  funded_member_count: string | number;
  any_spend_count: string | number;
  fully_spent_count: string | number;
  buckets: RawBucketRow[] | null;
};

const toNum = (v: string | number | null | undefined): number => {
  if (v === null || v === undefined) return 0;
  return typeof v === "string" ? Number(v) : v;
};

export async function runRoundResultsQuery(
  roundId: string
): Promise<RoundResultsPayload> {
  // Note: DB column names are legacy ("collectionId", "collectionMemberId")
  // and the Round table is named "Collection". See schema.prisma @map directives.
  const rows = await prisma.$queryRaw<RawRow[]>`
    WITH all_contributions AS (
      SELECT id,
             "collectionMemberId" AS rm_id,
             "bucketId",
             amount
      FROM "Contribution"
      WHERE "collectionId" = ${roundId}
        AND ("deleted" IS NULL OR "deleted" = false)
    ),
    all_allocations AS (
      SELECT "collectionMemberId" AS rm_id, amount
      FROM "Allocation"
      WHERE "collectionId" = ${roundId}
        AND ("deleted" IS NULL OR "deleted" = false)
    ),
    member_received AS (
      -- Both ADD and SET allocations store the *delta* in amount.
      -- Round-end "reset to zero" writes a negative delta, so SUM(amount)
      -- understates how much a member has cumulatively received across
      -- multi-cycle funding rounds. Sum only the positive deltas to get
      -- gross cumulative grants.
      SELECT rm_id,
             COALESCE(SUM(amount) FILTER (WHERE amount > 0), 0)::bigint AS received
      FROM all_allocations
      GROUP BY rm_id
    ),
    funded_members AS (
      SELECT rm_id, received FROM member_received WHERE received > 0
    ),
    member_spend AS (
      SELECT rm_id, COALESCE(SUM(amount), 0)::bigint AS spent
      FROM all_contributions
      WHERE rm_id IN (SELECT rm_id FROM funded_members)
      GROUP BY rm_id
    ),
    bucket_goals AS (
      SELECT bi."bucketId" AS bucket_id,
             GREATEST(SUM(bi.min) FILTER (WHERE bi.type = 'EXPENSE'), 0)::bigint AS min_goal,
             GREATEST(SUM(COALESCE(bi.max, bi.min)) FILTER (WHERE bi.type = 'EXPENSE'), 0)::bigint AS max_goal
      FROM "BudgetItem" bi
      WHERE bi."bucketId" IS NOT NULL
      GROUP BY bi."bucketId"
    ),
    bucket_stats AS (
      SELECT b.id,
             b.title,
             COALESCE(bg.min_goal, 0)::bigint AS min_goal,
             COALESCE(bg.max_goal, 0)::bigint AS max_goal,
             COUNT(c.id)::int AS contributions_count,
             COALESCE(SUM(c.amount), 0)::bigint AS contributions_sum,
             COUNT(DISTINCT c.rm_id)::int AS contributors_count,
             COUNT(c.id) FILTER (WHERE c.rm_id IN (SELECT rm_id FROM funded_members))::int AS contributions_count_funded,
             COALESCE(SUM(c.amount) FILTER (WHERE c.rm_id IN (SELECT rm_id FROM funded_members)), 0)::bigint AS contributions_sum_funded
      FROM "Bucket" b
      LEFT JOIN bucket_goals bg ON bg.bucket_id = b.id
      LEFT JOIN all_contributions c ON c."bucketId" = b.id
      WHERE b."collectionId" = ${roundId}
        AND b.deleted = false
        AND b."publishedAt" IS NOT NULL
        AND b."canceledAt" IS NULL
      GROUP BY b.id, b.title, bg.min_goal, bg.max_goal
    ),
    totals AS (
      SELECT COUNT(*)::int AS total_contrib_count,
             COALESCE(SUM(amount), 0)::bigint AS total_contrib_amount
      FROM all_contributions
    )
    SELECT
      (SELECT row_to_json(totals.*) FROM totals) AS totals,
      (SELECT COUNT(*)::int FROM funded_members) AS funded_member_count,
      (SELECT COUNT(*)::int
         FROM funded_members fm
         JOIN member_spend ms USING (rm_id)
         WHERE ms.spent > 0) AS any_spend_count,
      (SELECT COUNT(*)::int
         FROM funded_members fm
         LEFT JOIN member_spend ms USING (rm_id)
         WHERE COALESCE(ms.spent, 0) >= fm.received) AS fully_spent_count,
      COALESCE((SELECT json_agg(bucket_stats.* ORDER BY contributions_sum DESC) FROM bucket_stats), '[]'::json) AS buckets;
  `;

  const row = rows[0];
  const totalContributionsCount = toNum(row.totals.total_contrib_count);
  const totalContributionsAmount = toNum(row.totals.total_contrib_amount);
  const fundedParticipantCount = toNum(row.funded_member_count);
  const anySpendParticipantCount = toNum(row.any_spend_count);
  const fullySpentParticipantCount = toNum(row.fully_spent_count);

  const buckets: BucketResultRow[] = (row.buckets ?? []).map((b) => ({
    id: b.id,
    title: b.title,
    minGoal: toNum(b.min_goal),
    maxGoal: toNum(b.max_goal),
    contributionsCount: toNum(b.contributions_count),
    contributionsSum: toNum(b.contributions_sum),
    contributorsCount: toNum(b.contributors_count),
    contributionsCountFundedOnly: toNum(b.contributions_count_funded),
    contributionsSumFundedOnly: toNum(b.contributions_sum_funded),
  }));

  const averageContributionAmount =
    totalContributionsCount > 0
      ? totalContributionsAmount / totalContributionsCount
      : 0;

  const participationRate =
    fundedParticipantCount > 0
      ? anySpendParticipantCount / fundedParticipantCount
      : 0;

  const fullParticipationRate =
    fundedParticipantCount > 0
      ? fullySpentParticipantCount / fundedParticipantCount
      : 0;

  return {
    totalContributionsCount,
    totalContributionsAmount,
    averageContributionAmount,
    participationRate,
    fullParticipationRate,
    fundedParticipantCount,
    anySpendParticipantCount,
    fullySpentParticipantCount,
    buckets,
  };
}
