import React from "react";

type Props = {
  label: React.ReactNode;
  value: React.ReactNode;
  helper?: React.ReactNode;
};

const StatTile: React.FC<Props> = ({ label, value, helper }) => (
  <div className="bg-white rounded shadow p-5 flex flex-col justify-between min-h-[120px]">
    <div className="text-sm text-gray-500 uppercase tracking-wide">{label}</div>
    <div className="text-3xl font-semibold text-gray-900 mt-2">{value}</div>
    {helper ? (
      <div className="text-xs text-gray-500 mt-2">{helper}</div>
    ) : null}
  </div>
);

export default StatTile;
