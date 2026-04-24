import React from "react";
import { FormattedMessage } from "react-intl";

const EmptyResults: React.FC = () => (
  <div className="bg-white rounded shadow p-10 text-center">
    <h2 className="text-xl font-semibold text-gray-800">
      <FormattedMessage defaultMessage="No results yet" />
    </h2>
    <p className="text-gray-500 mt-2 max-w-md mx-auto">
      <FormattedMessage defaultMessage="Results will appear here once participants start funding dreams in this round." />
    </p>
  </div>
);

export default EmptyResults;
