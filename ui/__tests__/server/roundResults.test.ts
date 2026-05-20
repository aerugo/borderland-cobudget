import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    roundResultsSnapshot: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    $queryRaw: vi.fn(),
  },
}));

vi.mock("server/prisma", () => ({ default: mockPrisma }));

import {
  getRoundResults,
  computeRoundResults,
  invalidateRoundResultsSnapshot,
  ROUND_RESULTS_SCHEMA_VERSION,
} from "server/services/RoundResultsService";

const ROUND_ID = "round_1";

const emptyRawRow = {
  totals: { total_contrib_count: 0, total_contrib_amount: 0 },
  funded_member_count: 0,
  any_spend_count: 0,
  fully_spent_count: 0,
  buckets: [],
  dreams_funded_per_contributor: [],
};

const fullRawRow = {
  totals: { total_contrib_count: 5, total_contrib_amount: 1000 },
  funded_member_count: 4,
  any_spend_count: 4,
  fully_spent_count: 3,
  dreams_funded_per_contributor: [3, "2", 1, 1],
  buckets: [
    {
      id: "b1",
      title: "Dream A",
      min_goal: "200",
      max_goal: "400",
      contributions_count: 3,
      contributions_sum: "600",
      contributors_count: 3,
      contributions_count_funded: 2,
      contributions_sum_funded: "500",
    },
    {
      id: "b2",
      title: "Dream B",
      min_goal: 100,
      max_goal: 100,
      contributions_count: 2,
      contributions_sum: 400,
      contributors_count: 2,
      contributions_count_funded: 2,
      contributions_sum_funded: 400,
    },
  ],
};

describe("RoundResultsService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("computeRoundResults transformation", () => {
    it("maps an empty round to zero scalars and an empty bucket array", async () => {
      mockPrisma.$queryRaw.mockResolvedValue([emptyRawRow]);
      const payload = await computeRoundResults(ROUND_ID);
      expect(payload).toEqual({
        totalContributionsCount: 0,
        totalContributionsAmount: 0,
        averageContributionAmount: 0,
        participationRate: 0,
        fullParticipationRate: 0,
        fundedParticipantCount: 0,
        anySpendParticipantCount: 0,
        fullySpentParticipantCount: 0,
        buckets: [],
        dreamsFundedPerContributor: [],
      });
    });

    it("computes averages and rates from raw rows and coerces string numerics", async () => {
      mockPrisma.$queryRaw.mockResolvedValue([fullRawRow]);
      const payload = await computeRoundResults(ROUND_ID);
      expect(payload.totalContributionsCount).toBe(5);
      expect(payload.totalContributionsAmount).toBe(1000);
      expect(payload.averageContributionAmount).toBeCloseTo(200);
      expect(payload.fundedParticipantCount).toBe(4);
      expect(payload.anySpendParticipantCount).toBe(4);
      expect(payload.participationRate).toBeCloseTo(1);
      expect(payload.fullySpentParticipantCount).toBe(3);
      expect(payload.fullParticipationRate).toBeCloseTo(0.75);
      expect(payload.dreamsFundedPerContributor).toEqual([3, 2, 1, 1]);
      expect(payload.buckets).toHaveLength(2);
      expect(payload.buckets[0]).toEqual({
        id: "b1",
        title: "Dream A",
        minGoal: 200,
        maxGoal: 400,
        contributionsCount: 3,
        contributionsSum: 600,
        contributorsCount: 3,
        contributionsCountFundedOnly: 2,
        contributionsSumFundedOnly: 500,
      });
    });

    it("treats null buckets array from json_agg as empty", async () => {
      mockPrisma.$queryRaw.mockResolvedValue([
        { ...emptyRawRow, buckets: null, dreams_funded_per_contributor: null },
      ]);
      const payload = await computeRoundResults(ROUND_ID);
      expect(payload.buckets).toEqual([]);
      expect(payload.dreamsFundedPerContributor).toEqual([]);
    });
  });

  describe("getRoundResults caching", () => {
    it("returns the snapshot when fresh and matches the current schema version", async () => {
      const computedAt = new Date();
      mockPrisma.roundResultsSnapshot.findUnique.mockResolvedValue({
        roundId: ROUND_ID,
        schemaVersion: ROUND_RESULTS_SCHEMA_VERSION,
        computedAt,
        payload: { ...emptyRawRow, buckets: [] },
      });

      const res = await getRoundResults(ROUND_ID);
      expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
      expect(mockPrisma.roundResultsSnapshot.upsert).not.toHaveBeenCalled();
      expect(res.computedAt).toBe(computedAt);
      expect(res.isStale).toBe(false);
    });

    it("recomputes and writes the snapshot when none exists", async () => {
      mockPrisma.roundResultsSnapshot.findUnique.mockResolvedValue(null);
      mockPrisma.$queryRaw.mockResolvedValue([emptyRawRow]);
      const written = { computedAt: new Date() };
      mockPrisma.roundResultsSnapshot.upsert.mockResolvedValue(written);

      const res = await getRoundResults(ROUND_ID);
      expect(mockPrisma.$queryRaw).toHaveBeenCalledOnce();
      expect(mockPrisma.roundResultsSnapshot.upsert).toHaveBeenCalledOnce();
      expect(res.computedAt).toBe(written.computedAt);
    });

    it("recomputes when the snapshot's schemaVersion is below the current version", async () => {
      mockPrisma.roundResultsSnapshot.findUnique.mockResolvedValue({
        roundId: ROUND_ID,
        schemaVersion: ROUND_RESULTS_SCHEMA_VERSION - 1,
        computedAt: new Date(),
        payload: { ...emptyRawRow, buckets: [] },
      });
      mockPrisma.$queryRaw.mockResolvedValue([emptyRawRow]);
      mockPrisma.roundResultsSnapshot.upsert.mockResolvedValue({
        computedAt: new Date(),
      });

      await getRoundResults(ROUND_ID);
      expect(mockPrisma.$queryRaw).toHaveBeenCalledOnce();
      expect(mockPrisma.roundResultsSnapshot.upsert).toHaveBeenCalledOnce();
    });

    it("recomputes when the snapshot is older than the TTL ceiling", async () => {
      mockPrisma.roundResultsSnapshot.findUnique.mockResolvedValue({
        roundId: ROUND_ID,
        schemaVersion: ROUND_RESULTS_SCHEMA_VERSION,
        computedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        payload: { ...emptyRawRow, buckets: [] },
      });
      mockPrisma.$queryRaw.mockResolvedValue([emptyRawRow]);
      mockPrisma.roundResultsSnapshot.upsert.mockResolvedValue({
        computedAt: new Date(),
      });

      await getRoundResults(ROUND_ID);
      expect(mockPrisma.$queryRaw).toHaveBeenCalledOnce();
    });
  });

  describe("invalidateRoundResultsSnapshot", () => {
    it("deletes the snapshot row for the given round", async () => {
      mockPrisma.roundResultsSnapshot.deleteMany.mockResolvedValue({ count: 1 });
      await invalidateRoundResultsSnapshot(ROUND_ID);
      expect(mockPrisma.roundResultsSnapshot.deleteMany).toHaveBeenCalledWith({
        where: { roundId: ROUND_ID },
      });
    });
  });
});
