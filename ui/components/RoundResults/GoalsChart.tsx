import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { FormattedMessage } from "react-intl";
import type { Bin } from "./bins";
import { buildCurrencyBins } from "./bins";

type BucketGoals = { id: string; minGoal: number; maxGoal: number };

type Props = {
  buckets: BucketGoals[];
  ariaLabel: string;
};

const mergeBins = (
  minBins: Bin[],
  maxBins: Bin[]
): { label: string; min: number; max: number }[] => {
  return minBins.map((b, i) => ({
    label: b.label,
    min: b.count,
    max: maxBins[i].count,
  }));
};

const GoalsChart: React.FC<Props> = ({ buckets, ariaLabel }) => {
  const minBins = buildCurrencyBins(
    buckets.map((b) => b.minGoal).filter((v) => v > 0)
  );
  const maxBins = buildCurrencyBins(
    buckets.map((b) => b.maxGoal).filter((v) => v > 0)
  );
  const data = mergeBins(minBins, maxBins);
  const noData = data.every((d) => d.min === 0 && d.max === 0);

  return (
    <div className="bg-white rounded shadow p-5">
      <header className="mb-4">
        <h3 className="text-base font-semibold text-gray-900">
          <FormattedMessage defaultMessage="Dream sizes" />
        </h3>
        <p className="text-sm text-gray-500 mt-0.5">
          <FormattedMessage defaultMessage="How many dreams are at each goal size, comparing minimum vs. stretch budgets." />
        </p>
      </header>
      <div className="h-64 w-full" role="img" aria-label={ariaLabel}>
        {noData ? (
          <div className="h-full flex items-center justify-center text-sm text-gray-400">
            <FormattedMessage defaultMessage="No published dreams have budget items yet." />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip
                cursor={{ fill: "rgba(0,0,0,0.04)" }}
                formatter={(value: number, name: string) => [`${value} dreams`, name]}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="min" name="Minimum goal" fill="#6366f1" radius={[3, 3, 0, 0]} />
              <Bar dataKey="max" name="Stretch goal" fill="#a5b4fc" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
      <table className="sr-only">
        <caption>{ariaLabel}</caption>
        <thead>
          <tr>
            <th>Goal range</th>
            <th>Dreams at min goal</th>
            <th>Dreams at stretch goal</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.label}>
              <td>{d.label}</td>
              <td>{d.min}</td>
              <td>{d.max}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default GoalsChart;
