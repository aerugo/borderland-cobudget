import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { Bin } from "./bins";

type Props = {
  title: React.ReactNode;
  description?: React.ReactNode;
  xLabel: string;
  bins: Bin[];
  color?: string;
  ariaLabel: string;
  unit?: string;
  yLabel?: string;
};

const DistributionChart: React.FC<Props> = ({
  title,
  description,
  xLabel,
  bins,
  color = "#ef4444",
  ariaLabel,
  unit = "dreams",
  yLabel = "Dream count",
}) => {
  const data = bins.map((b) => ({ label: b.label, count: b.count }));
  const total = bins.reduce((s, b) => s + b.count, 0);

  return (
    <div className="bg-white rounded shadow p-5">
      <header className="mb-4">
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        {description ? (
          <p className="text-sm text-gray-500 mt-0.5">{description}</p>
        ) : null}
      </header>
      <div
        className="h-56 w-full"
        role="img"
        aria-label={ariaLabel}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11 }}
              label={{
                value: xLabel,
                position: "insideBottom",
                offset: -2,
                fontSize: 11,
                fill: "#6b7280",
              }}
            />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip
              cursor={{ fill: "rgba(0,0,0,0.04)" }}
              formatter={(value: number) => [`${value} ${unit}`, ""]}
            />
            <Bar dataKey="count" fill={color} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>{ariaLabel}</caption>
        <thead>
          <tr>
            <th>{xLabel}</th>
            <th>{yLabel}</th>
          </tr>
        </thead>
        <tbody>
          {bins.map((b) => (
            <tr key={b.label}>
              <td>{b.label}</td>
              <td>{b.count}</td>
            </tr>
          ))}
          <tr>
            <td>Total</td>
            <td>{total}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export default DistributionChart;
