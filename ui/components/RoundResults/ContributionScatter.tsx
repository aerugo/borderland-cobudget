import React from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { FormattedMessage } from "react-intl";

type Bucket = {
  id: string;
  title: string;
  contributionsCountFundedOnly: number;
  contributionsSumFundedOnly: number;
};

type Props = {
  buckets: Bucket[];
  currency: string;
  ariaLabel: string;
};

const ContributionScatter: React.FC<Props> = ({ buckets, currency, ariaLabel }) => {
  const data = buckets
    .filter((b) => b.contributionsCountFundedOnly > 0)
    .map((b) => ({
      x: b.contributionsCountFundedOnly,
      y: b.contributionsSumFundedOnly / 100,
      title: b.title,
      id: b.id,
    }));

  return (
    <div className="bg-white rounded shadow p-5">
      <header className="mb-4">
        <h3 className="text-base font-semibold text-gray-900">
          <FormattedMessage defaultMessage="Contribution patterns" />
        </h3>
        <p className="text-sm text-gray-500 mt-0.5">
          <FormattedMessage defaultMessage="Each dot is a dream, plotted by how many contributions it received (from funded participants) against the total amount it raised." />
        </p>
      </header>
      <div className="h-72 w-full" role="img" aria-label={ariaLabel}>
        {data.length === 0 ? (
          <div className="h-full flex items-center justify-center text-sm text-gray-400">
            <FormattedMessage defaultMessage="No qualifying contributions yet." />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 8, right: 12, left: 12, bottom: 24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis
                type="number"
                dataKey="x"
                name="Contributions"
                tick={{ fontSize: 11 }}
                label={{
                  value: "Contributions received",
                  position: "insideBottom",
                  offset: -8,
                  fontSize: 11,
                  fill: "#6b7280",
                }}
              />
              <YAxis
                type="number"
                dataKey="y"
                name="Total"
                tick={{ fontSize: 11 }}
                label={{
                  value: `Total raised (${currency})`,
                  angle: -90,
                  position: "insideLeft",
                  fontSize: 11,
                  fill: "#6b7280",
                }}
              />
              <ZAxis range={[40, 40]} />
              <Tooltip
                cursor={{ strokeDasharray: "3 3" }}
                content={({ active, payload }) => {
                  if (!active || !payload || !payload[0]) return null;
                  const p: any = payload[0].payload;
                  return (
                    <div className="bg-white border border-gray-200 rounded px-3 py-2 text-xs shadow">
                      <div className="font-semibold text-gray-900 mb-1">{p.title}</div>
                      <div className="text-gray-600">
                        {p.x} contributions · {currency}{" "}
                        {p.y.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </div>
                    </div>
                  );
                }}
              />
              <Scatter
                data={data}
                fill="#0ea5e9"
                fillOpacity={0.55}
                stroke="#0369a1"
              />
            </ScatterChart>
          </ResponsiveContainer>
        )}
      </div>
      <table className="sr-only">
        <caption>{ariaLabel}</caption>
        <thead>
          <tr>
            <th>Dream</th>
            <th>Contributions (funded)</th>
            <th>Total raised (funded, {currency})</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.id}>
              <td>{d.title}</td>
              <td>{d.x}</td>
              <td>{d.y.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ContributionScatter;
