import { useMemo, useState } from "react";
import { gql, useMutation } from "urql";
import { FormattedNumber } from "react-intl";

const SET_FREUD_TOTAL_BUDGET = gql`
  mutation SetFreudTotalBudget($roundId: ID!, $amount: Int) {
    setFreudTotalBudget(roundId: $roundId, amount: $amount) {
      id
      freudTotalBudget
    }
  }
`;

export default function BudgetSummaryPanel({
  round,
  bucketData,
}: {
  round: any;
  bucketData: any[];
}) {
  const [editing, setEditing] = useState(false);
  const [budgetInput, setBudgetInput] = useState(
    String(round?.freudTotalBudget ?? "")
  );
  const [, setFreudBudget] = useMutation(SET_FREUD_TOTAL_BUDGET);

  const stats = useMemo(() => {
    const publishedBuckets = bucketData.filter(
      (d) => d.bucket.published
    );
    const allMinGoal = bucketData.reduce((sum, d) => sum + d.goal, 0);
    const publishedMinGoal = publishedBuckets.reduce(
      (sum, d) => sum + d.goal,
      0
    );
    const distributed = bucketData.reduce((sum, d) => sum + d.funded, 0);
    const totalBudget = round?.freudTotalBudget ?? 0;
    const remaining = totalBudget - distributed;

    return {
      totalBudget,
      publishedMinGoal,
      allMinGoal,
      distributed,
      remaining,
    };
  }, [bucketData, round?.freudTotalBudget]);

  const handleSaveBudget = async () => {
    const amount = budgetInput ? parseInt(budgetInput, 10) : null;
    await setFreudBudget({ roundId: round.id, amount });
    setEditing(false);
  };

  const currency = round?.currency ?? "SEK";

  return (
    <div className="bg-white border rounded-lg p-4 mb-4">
      <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
        <div>
          <span className="text-gray-500">Set total budget: </span>
          {editing ? (
            <span className="inline-flex items-center gap-1">
              <input
                type="number"
                value={budgetInput}
                onChange={(e) => setBudgetInput(e.target.value)}
                className="border rounded px-2 py-0.5 w-32 text-sm"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveBudget();
                  if (e.key === "Escape") setEditing(false);
                }}
              />
              <button
                onClick={handleSaveBudget}
                className="text-xs text-blue-600 hover:underline"
              >
                Save
              </button>
            </span>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="font-medium hover:underline"
            >
              {stats.totalBudget ? (
                <FormattedNumber
                  value={stats.totalBudget}
                  style="decimal"
                  maximumFractionDigits={0}
                />
              ) : (
                "Not set"
              )}{" "}
              {currency}
            </button>
          )}
        </div>
        <div>
          <span className="text-gray-500">Min budget (published): </span>
          <span className="font-medium">
            <FormattedNumber
              value={stats.publishedMinGoal}
              style="decimal"
              maximumFractionDigits={0}
            />{" "}
            {currency}
          </span>
        </div>
        <div>
          <span className="text-gray-500">Min budget (all): </span>
          <span className="font-medium">
            <FormattedNumber
              value={stats.allMinGoal}
              style="decimal"
              maximumFractionDigits={0}
            />{" "}
            {currency}
          </span>
        </div>
        <div>
          <span className="text-gray-500">Distributed: </span>
          <span className="font-medium">
            <FormattedNumber
              value={stats.distributed}
              style="decimal"
              maximumFractionDigits={0}
            />{" "}
            {currency}
          </span>
        </div>
        <div>
          <span className="text-gray-500">Remaining: </span>
          <span
            className={`font-medium ${stats.remaining < 0 ? "text-red-600" : ""}`}
          >
            <FormattedNumber
              value={stats.remaining}
              style="decimal"
              maximumFractionDigits={0}
            />{" "}
            {currency}
          </span>
        </div>
      </div>
    </div>
  );
}
