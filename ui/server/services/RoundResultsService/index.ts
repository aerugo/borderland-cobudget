import prisma from "../../prisma";
import { runRoundResultsQuery } from "./sql";
import { RoundResultsPayload, RoundResultsResponse } from "./types";

export const ROUND_RESULTS_SCHEMA_VERSION = 2;
const TTL_MS = 60 * 60 * 1000;

export async function computeRoundResults(
  roundId: string
): Promise<RoundResultsPayload> {
  return runRoundResultsQuery(roundId);
}

export async function getRoundResults(
  roundId: string
): Promise<RoundResultsResponse> {
  const snapshot = await prisma.roundResultsSnapshot.findUnique({
    where: { roundId },
  });

  const fresh =
    snapshot &&
    snapshot.schemaVersion === ROUND_RESULTS_SCHEMA_VERSION &&
    Date.now() - snapshot.computedAt.getTime() < TTL_MS;

  if (fresh && snapshot) {
    return {
      ...(snapshot.payload as unknown as RoundResultsPayload),
      computedAt: snapshot.computedAt,
      isStale: false,
    };
  }

  const payload = await computeRoundResults(roundId);
  const written = await prisma.roundResultsSnapshot.upsert({
    where: { roundId },
    update: {
      payload: payload as unknown as object,
      schemaVersion: ROUND_RESULTS_SCHEMA_VERSION,
      computedAt: new Date(),
    },
    create: {
      roundId,
      payload: payload as unknown as object,
      schemaVersion: ROUND_RESULTS_SCHEMA_VERSION,
    },
  });

  return {
    ...payload,
    computedAt: written.computedAt,
    isStale: false,
  };
}

export async function invalidateRoundResultsSnapshot(
  roundId: string
): Promise<void> {
  await prisma.roundResultsSnapshot.deleteMany({ where: { roundId } });
}

export type { BucketResultRow, RoundResultsPayload, RoundResultsResponse } from "./types";
