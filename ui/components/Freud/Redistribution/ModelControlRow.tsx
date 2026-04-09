import { useState, useCallback } from "react";
import {
  FreudDream,
  SortMethod,
  RedistributionState,
  initRedistribution,
  stepRedistribution,
  finishRedistribution,
  getNextBucket,
} from "utils/freud-redistribution";
import { FormattedNumber } from "react-intl";

interface ModelControlRowProps {
  method: SortMethod;
  label: string;
  description: string;
  dreams: FreudDream[];
  goals: Record<string, number>;
  onResult: (method: SortMethod, state: RedistributionState | null) => void;
}

export default function ModelControlRow({
  method,
  label,
  description,
  dreams,
  goals,
  onResult,
}: ModelControlRowProps) {
  const [state, setState] = useState<RedistributionState | null>(null);
  const [loopMode, setLoopMode] = useState(false);

  const handleRun = useCallback(() => {
    if (!state) {
      const initial = initRedistribution(dreams, method);
      if (loopMode) {
        const stepped = stepRedistribution(initial, goals);
        setState(stepped);
        onResult(method, stepped);
      } else {
        const finished = finishRedistribution(initial, goals);
        setState(finished);
        onResult(method, finished);
      }
    } else if (state.isComplete) {
      return;
    } else if (loopMode) {
      const stepped = stepRedistribution(state, goals);
      setState(stepped);
      onResult(method, stepped);
    } else {
      const finished = finishRedistribution(state, goals);
      setState(finished);
      onResult(method, finished);
    }
  }, [state, dreams, method, loopMode, goals, onResult]);

  const handleReset = useCallback(() => {
    setState(null);
    onResult(method, null);
  }, [method, onResult]);

  const nextBucket = state ? getNextBucket(state, goals) : null;
  const nextDream = nextBucket
    ? dreams.find((d) => d.id === nextBucket.bucketId)
    : null;

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
          {!state
            ? "Run"
            : state.isComplete
            ? "Done"
            : loopMode
            ? "Step"
            : "Finish run"}
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
      <td className="px-3 py-2 text-xs text-gray-500 max-w-[120px] truncate">
        {nextDream?.title ?? "—"}
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
