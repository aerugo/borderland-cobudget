import { useState, useCallback } from "react";
import {
  FreudDream,
  SortMethod,
  RedistributionState,
  initRedistribution,
  stepRedistribution,
  finishRedistribution,
  getNextBuckets,
} from "utils/freud-redistribution";
import { FormattedNumber } from "react-intl";

interface ModelControlRowProps {
  method: SortMethod;
  label: string;
  description: string;
  dreams: FreudDream[];
  goals: Record<string, number>;
  totalBudget: number;
  onResult: (method: SortMethod, state: RedistributionState | null) => void;
}

export default function ModelControlRow({
  method,
  label,
  description,
  dreams,
  goals,
  totalBudget,
  onResult,
}: ModelControlRowProps) {
  const [state, setState] = useState<RedistributionState | null>(null);
  const [loopMode, setLoopMode] = useState(false);

  const handleRun = useCallback(() => {
    const current = state ?? initRedistribution(dreams, method, totalBudget);
    if (current.isComplete) return;
    const next = loopMode
      ? finishRedistribution(current, goals)
      : stepRedistribution(current, goals);
    setState(next);
    onResult(method, next);
  }, [state, dreams, method, loopMode, goals, totalBudget, onResult]);

  const handleReset = useCallback(() => {
    setState(null);
    onResult(method, null);
  }, [method, onResult]);

  const next = state ? getNextBuckets(state, goals) : null;
  const nextFundDream = next?.nextToFund
    ? dreams.find((d) => d.id === next.nextToFund)
    : null;
  const nextDefundDream = next?.nextToDefund
    ? dreams.find((d) => d.id === next.nextToDefund)
    : null;

  const buttonLabel = !state
    ? "Run"
    : state.isComplete
    ? "Done"
    : loopMode
    ? "Run all"
    : "Run";

  return (
    <tr className="border-b">
      <td className="px-3 py-2 font-semibold text-sm">{label}</td>
      <td className="px-3 py-2 text-xs text-gray-500">{description}</td>
      <td className="px-3 py-2">
        <button
          onClick={handleReset}
          disabled={!state}
          className="border rounded px-2 py-0.5 text-xs disabled:opacity-30 hover:bg-gray-50"
        >
          Reset
        </button>
      </td>
      <td className="px-3 py-2">
        <button
          onClick={handleRun}
          disabled={state?.isComplete}
          className="bg-blue-600 text-white rounded px-3 py-0.5 text-xs disabled:opacity-50 hover:bg-blue-700"
        >
          {buttonLabel}
        </button>
      </td>
      <td className="px-3 py-2">
        <label className="flex items-center gap-1 text-xs cursor-pointer">
          <input
            type="checkbox"
            checked={loopMode}
            onChange={(e) => setLoopMode(e.target.checked)}
            className="cursor-pointer"
          />
          Loop
        </label>
      </td>
      <td className="px-3 py-2 text-xs text-gray-500 max-w-[160px]">
        <div className="truncate" title={nextFundDream?.title ?? ""}>
          <span className="text-green-600">+</span>{" "}
          {nextFundDream?.title ?? "—"}
        </div>
        <div className="truncate" title={nextDefundDream?.title ?? ""}>
          <span className="text-red-500">−</span>{" "}
          {nextDefundDream?.title ?? "—"}
        </div>
      </td>
      <td className="px-3 py-2 text-xs text-right">
        {state?.totalFunded ?? "—"}
      </td>
      <td className="px-3 py-2 text-xs text-right">
        {state ? (
          <FormattedNumber
            value={state.totalContributed}
            style="decimal"
            maximumFractionDigits={0}
          />
        ) : (
          "—"
        )}
      </td>
    </tr>
  );
}
