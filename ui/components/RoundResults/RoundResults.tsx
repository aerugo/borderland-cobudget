import React, { useMemo } from "react";
import { useQuery, gql } from "urql";
import { FormattedMessage, FormattedNumber, FormattedRelativeTime } from "react-intl";
import dayjs from "dayjs";
import FormattedCurrency from "components/FormattedCurrency";
import StatTile from "./StatTile";
import EmptyResults from "./EmptyResults";
import DistributionChart from "./DistributionChart";
import GoalsChart from "./GoalsChart";
import ContributionScatter from "./ContributionScatter";
import { buildIntegerBins, buildCurrencyBins } from "./bins";

export const ROUND_RESULTS_QUERY = gql`
  query RoundResults($roundId: ID!) {
    roundResults(roundId: $roundId) {
      totalContributionsCount
      totalContributionsAmount
      averageContributionAmount
      participationRate
      fullParticipationRate
      fundedParticipantCount
      anySpendParticipantCount
      fullySpentParticipantCount
      buckets {
        id
        title
        minGoal
        maxGoal
        contributionsCount
        contributionsSum
        contributorsCount
        contributionsCountFundedOnly
        contributionsSumFundedOnly
      }
      computedAt
      isStale
    }
  }
`;

type Props = {
  round: { id: string; currency: string; grantingCloses?: string | null };
};

const RoundResults: React.FC<Props> = ({ round }) => {
  const [{ data, fetching, error }] = useQuery({
    query: ROUND_RESULTS_QUERY,
    variables: { roundId: round.id },
  });

  const results = data?.roundResults;
  const fundedBuckets = useMemo(
    () => (results?.buckets ?? []).filter((b: any) => b.contributionsCount > 0),
    [results]
  );

  const sumBins = useMemo(
    () => buildCurrencyBins(fundedBuckets.map((b: any) => b.contributionsSum)),
    [fundedBuckets]
  );
  const countBins = useMemo(
    () => buildIntegerBins(fundedBuckets.map((b: any) => b.contributionsCount)),
    [fundedBuckets]
  );
  const contributorBins = useMemo(
    () => buildIntegerBins(fundedBuckets.map((b: any) => b.contributorsCount)),
    [fundedBuckets]
  );

  if (fetching && !data) {
    return (
      <div className="page py-10 text-gray-500">
        <FormattedMessage defaultMessage="Loading results…" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="page py-10 text-red-600">
        <FormattedMessage defaultMessage="Could not load results." />
      </div>
    );
  }

  if (!results) return <div className="page" />;

  if (results.totalContributionsCount === 0) {
    return (
      <div className="page py-6">
        <EmptyResults />
      </div>
    );
  }

  const computedAt = dayjs(results.computedAt);
  const secondsAgo = computedAt.diff(dayjs(), "second");
  const grantingClosed =
    round.grantingCloses && dayjs(round.grantingCloses).isBefore(dayjs());

  return (
    <div className="page py-6 space-y-10">
      <header>
        <h1 className="text-2xl font-semibold text-gray-900">
          <FormattedMessage defaultMessage="Results" />
        </h1>
        <p className="text-gray-500 mt-1">
          <FormattedMessage defaultMessage="A snapshot of how funding played out in this round." />
        </p>
      </header>

      <section
        className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
        aria-label="Headline statistics"
      >
        <StatTile
          label={<FormattedMessage defaultMessage="Contributions made" />}
          value={<FormattedNumber value={results.totalContributionsCount} />}
        />
        <StatTile
          label={<FormattedMessage defaultMessage="Total funded" />}
          value={
            <FormattedCurrency
              value={results.totalContributionsAmount}
              currency={round.currency}
              maximumFractionDigits={0}
            />
          }
        />
        <StatTile
          label={<FormattedMessage defaultMessage="Average contribution" />}
          value={
            <FormattedCurrency
              value={Math.round(results.averageContributionAmount)}
              currency={round.currency}
              maximumFractionDigits={0}
            />
          }
        />
        <StatTile
          label={<FormattedMessage defaultMessage="Participation" />}
          value={
            <FormattedNumber
              value={results.participationRate}
              style="percent"
              maximumFractionDigits={0}
            />
          }
          helper={
            <FormattedMessage
              defaultMessage="{spent} of {funded} funded participants made at least one contribution"
              values={{
                spent: results.anySpendParticipantCount,
                funded: results.fundedParticipantCount,
              }}
            />
          }
        />
        <StatTile
          label={<FormattedMessage defaultMessage="Full participation" />}
          value={
            <FormattedNumber
              value={results.fullParticipationRate}
              style="percent"
              maximumFractionDigits={0}
            />
          }
          helper={
            <FormattedMessage
              defaultMessage="{spent} of {funded} funded participants spent everything"
              values={{
                spent: results.fullySpentParticipantCount,
                funded: results.fundedParticipantCount,
              }}
            />
          }
        />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">
          <FormattedMessage defaultMessage="Where the money went" />
        </h2>
        <p className="text-sm text-gray-500 -mt-2">
          <FormattedMessage
            defaultMessage="Distributions across the {count} dreams that received at least one contribution."
            values={{ count: fundedBuckets.length }}
          />
        </p>
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
          <DistributionChart
            title={<FormattedMessage defaultMessage="Total received" />}
            description={
              <FormattedMessage defaultMessage="How much each dream raised." />
            }
            xLabel={`Total raised (${round.currency})`}
            bins={sumBins}
            color="#10b981"
            ariaLabel="Distribution of dreams by total amount received"
          />
          <DistributionChart
            title={<FormattedMessage defaultMessage="Number of contributions" />}
            description={
              <FormattedMessage defaultMessage="How many funding actions each dream attracted." />
            }
            xLabel="Contributions received"
            bins={countBins}
            color="#f59e0b"
            ariaLabel="Distribution of dreams by number of contributions"
          />
          <DistributionChart
            title={<FormattedMessage defaultMessage="Number of contributors" />}
            description={
              <FormattedMessage defaultMessage="How many distinct people contributed to each dream." />
            }
            xLabel="Unique contributors"
            bins={contributorBins}
            color="#8b5cf6"
            ariaLabel="Distribution of dreams by number of unique contributors"
          />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">
          <FormattedMessage defaultMessage="Dream sizes" />
        </h2>
        <GoalsChart
          buckets={results.buckets}
          ariaLabel="Distribution of published dreams by minimum and stretch goal"
        />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">
          <FormattedMessage defaultMessage="Contribution patterns" />
        </h2>
        <ContributionScatter
          buckets={results.buckets}
          currency={round.currency}
          ariaLabel="Per-dream scatter of contribution count against total raised, restricted to contributions from funded participants"
        />
      </section>

      <footer className="text-xs text-gray-500 pt-4 border-t border-gray-200">
        {grantingClosed ? (
          <FormattedMessage
            defaultMessage="Final results · Round closed on {date}"
            values={{ date: dayjs(round.grantingCloses).format("MMM D, YYYY") }}
          />
        ) : (
          <FormattedMessage
            defaultMessage="Updated {when}"
            values={{
              when: (
                <FormattedRelativeTime
                  value={secondsAgo}
                  numeric="auto"
                  updateIntervalInSeconds={30}
                />
              ),
            }}
          />
        )}
      </footer>
    </div>
  );
};

export default RoundResults;
