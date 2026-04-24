export type BucketResultRow = {
  id: string;
  title: string;
  minGoal: number;
  maxGoal: number;
  contributionsCount: number;
  contributionsSum: number;
  contributorsCount: number;
  contributionsCountFundedOnly: number;
  contributionsSumFundedOnly: number;
};

export type RoundResultsPayload = {
  totalContributionsCount: number;
  totalContributionsAmount: number;
  averageContributionAmount: number;
  participationRate: number;
  fullParticipationRate: number;
  fundedParticipantCount: number;
  anySpendParticipantCount: number;
  fullySpentParticipantCount: number;
  buckets: BucketResultRow[];
};

export type RoundResultsResponse = RoundResultsPayload & {
  computedAt: Date;
  isStale: boolean;
};
