import { useMemo, useState, useCallback } from "react";
import { gql, useQuery, useMutation } from "urql";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
} from "@mui/material";
import { FormattedNumber } from "react-intl";
import ModelControlRow from "./ModelControlRow";
import FundOverrideCell from "./FundOverrideCell";
import { SummarySkeleton, TableSkeleton } from "../LoadingSkeleton";
import {
  FreudDream,
  SortMethod,
  RedistributionState,
} from "utils/freud-redistribution";

const FREUD_DATA_QUERY = gql`
  query FreudData($roundId: ID!) {
    freudData(roundId: $roundId) {
      bucket {
        id
        title
        approved
        published
      }
      goal
      stretch
      funded
      missing
      funders
      progress
      hearts {
        id
        member {
          id
          user {
            id
            username
            name
          }
        }
      }
      reviewedBy {
        member {
          id
          user {
            id
            username
            name
          }
        }
        lastVerdict
      }
    }
  }
`;

const TOGGLE_HEART = gql`
  mutation ToggleFreudHeart($bucketId: ID!) {
    toggleFreudHeart(bucketId: $bucketId)
  }
`;

const MODELS: { method: SortMethod; label: string; description: string }[] = [
  { method: "combo", label: "Combo", description: "Rank by A+B+C combo" },
  { method: "funders", label: "Funders", description: "Rank by funder count" },
  { method: "sek", label: "SEK", description: "Rank by SEK left to goal" },
  { method: "percent", label: "Percent", description: "Rank by % left to goal" },
];

export default function RedistributionPage({
  round,
  currentUser,
}: {
  round: any;
  currentUser: any;
}) {
  const [result] = useQuery({
    query: FREUD_DATA_QUERY,
    variables: { roundId: round.id },
    pause: !round?.id,
  });

  const [, toggleHeart] = useMutation(TOGGLE_HEART);
  const [showFunded, setShowFunded] = useState(false);
  const [modelResults, setModelResults] = useState<
    Record<SortMethod, RedistributionState | null>
  >({
    combo: null,
    funders: null,
    sek: null,
    percent: null,
  });
  const [overrides, setOverrides] = useState<
    Record<string, { override: "model" | "manual" | "skip" | "lock"; manualAmount?: number }>
  >({});

  type SortColumn =
    | "title"
    | "goal"
    | "stretch"
    | "funded"
    | "missing"
    | "funders"
    | "progress"
    | "combo"
    | "fundersModel"
    | "sek"
    | "percent"
    | "hearts";
  const [sort, setSort] = useState<{ column: SortColumn; direction: "asc" | "desc" }>({
    column: "title",
    direction: "asc",
  });
  const handleSort = useCallback((column: SortColumn) => {
    setSort((prev) =>
      prev.column === column
        ? { column, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { column, direction: "asc" }
    );
  }, []);

  const bucketData = result.data?.freudData ?? [];

  const dreams: FreudDream[] = useMemo(
    () =>
      bucketData.map((d) => {
        const ov = overrides[d.bucket.id];
        return {
          id: d.bucket.id,
          title: d.bucket.title,
          goal: d.goal,
          stretch: d.stretch,
          funded: d.funded,
          funders: d.funders,
          override: ov?.override,
          manualAmount: ov?.manualAmount,
        };
      }),
    [bucketData, overrides]
  );

  const goals: Record<string, number> = useMemo(() => {
    const g: Record<string, number> = {};
    for (const d of bucketData) g[d.bucket.id] = d.goal;
    return g;
  }, [bucketData]);

  const handleModelResult = useCallback(
    (method: SortMethod, state: RedistributionState | null) => {
      setModelResults((prev) => ({ ...prev, [method]: state }));
    },
    []
  );

  const filtered = useMemo(
    () => (showFunded ? bucketData : bucketData.filter((d) => d.funded < d.goal)),
    [bucketData, showFunded]
  );

  const sorted = useMemo(() => {
    const getValue = (d: any, column: SortColumn): number | string => {
      switch (column) {
        case "title":
          return (d.bucket.title ?? "").toLowerCase();
        case "goal":
          return d.goal ?? 0;
        case "stretch":
          return d.stretch ?? 0;
        case "funded":
          return d.funded ?? 0;
        case "missing":
          return d.missing ?? 0;
        case "funders":
          return d.funders ?? 0;
        case "progress":
          return d.goal > 0 ? d.funded / d.goal : 0;
        case "combo":
        case "sek":
        case "percent":
          return modelResults[column]?.amounts[d.bucket.id] ?? -Infinity;
        case "fundersModel":
          return modelResults.funders?.amounts[d.bucket.id] ?? -Infinity;
        case "hearts":
          return d.hearts?.length ?? 0;
      }
    };
    const arr = [...filtered];
    arr.sort((a, b) => {
      const va = getValue(a, sort.column);
      const vb = getValue(b, sort.column);
      let cmp: number;
      if (typeof va === "string" && typeof vb === "string") {
        cmp = va.localeCompare(vb);
      } else {
        cmp = (va as number) - (vb as number);
      }
      return sort.direction === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sort, modelResults]);

  const currency = round?.currency ?? "SEK";
  const totalBudget = round?.freudTotalBudget ?? 0;
  const totalAsked = bucketData.reduce((s, d) => s + d.goal, 0);
  const totalAskedStretch = bucketData.reduce((s, d) => s + d.stretch, 0);

  if (result.fetching) {
    return (
      <>
        <SummarySkeleton />
        <TableSkeleton rows={8} cols={10} />
      </>
    );
  }

  if (result.error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-500 mb-2">Failed to load redistribution data</div>
        <button
          onClick={() => result.fetching}
          className="text-sm text-blue-600 hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Budget Summary */}
      <div className="bg-white border rounded-lg p-4 mb-4 grid grid-cols-2 gap-4 text-sm">
        <div className="space-y-1">
          <div>
            <span className="text-gray-500">Total budget: </span>
            <span className="font-medium">
              <FormattedNumber value={totalBudget} style="decimal" maximumFractionDigits={0} /> {currency}
            </span>
          </div>
          <div>
            <span className="text-gray-500">Total asked for: </span>
            <FormattedNumber value={totalAsked} style="decimal" maximumFractionDigits={0} /> {currency}
          </div>
          <div>
            <span className="text-gray-500">Total asked (stretch): </span>
            <FormattedNumber value={totalAskedStretch} style="decimal" maximumFractionDigits={0} /> {currency}
          </div>
        </div>
        <div className="space-y-1">
          <div>
            <span className="text-gray-500">Dreams: </span>
            {bucketData.length} total, {bucketData.filter((d) => d.funded >= d.goal).length} funded
          </div>
        </div>
      </div>

      {/* Model Controls */}
      <div className="bg-white border rounded-lg mb-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="px-3 py-2 text-left text-xs text-gray-500">Model</th>
              <th className="px-3 py-2 text-left text-xs text-gray-500">Description</th>
              <th className="px-3 py-2 text-left text-xs text-gray-500">Reset</th>
              <th className="px-3 py-2 text-left text-xs text-gray-500">Run</th>
              <th className="px-3 py-2 text-left text-xs text-gray-500">Loop</th>
              <th className="px-3 py-2 text-left text-xs text-gray-500">Next +/−</th>
              <th className="px-3 py-2 text-right text-xs text-gray-500">Funded</th>
              <th className="px-3 py-2 text-right text-xs text-gray-500">Contributed</th>
            </tr>
          </thead>
          <tbody>
            {MODELS.map((m) => (
              <ModelControlRow
                key={m.method}
                method={m.method}
                label={m.label}
                description={m.description}
                dreams={dreams}
                goals={goals}
                totalBudget={totalBudget}
                onResult={handleModelResult}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Toggle */}
      <div className="flex items-center gap-4 mb-3">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={showFunded}
            onChange={(e) => setShowFunded(e.target.checked)}
          />
          Show dreams that reached goal in granting
        </label>
        <button
          onClick={() => {
            const headers = ["Dream", "Goal", "Stretch", "Funded", "Missing", "Funders", "Progress",
              "M:Combo", "M:Funders", "M:SEK", "M:Percent"];
            const getAmt = (method: SortMethod, id: string) => {
              const st = modelResults[method];
              return st?.amounts[id] ?? "";
            };
            const rows = filtered.map((d) => [
              `"${d.bucket.title.replace(/"/g, '""')}"`,
              d.goal, d.stretch, d.funded, d.missing, d.funders,
              d.goal > 0 ? Math.round((d.funded / d.goal) * 100) + "%" : "0%",
              getAmt("combo", d.bucket.id), getAmt("funders", d.bucket.id),
              getAmt("sek", d.bucket.id), getAmt("percent", d.bucket.id),
            ]);
            const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
            const blob = new Blob([csv], { type: "text/csv" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `freud-redistribution-${new Date().toISOString().slice(0, 10)}.csv`;
            a.click();
            URL.revokeObjectURL(url);
          }}
          className="text-sm text-blue-600 hover:underline"
        >
          Export CSV
        </button>
      </div>

      {/* Redistribution Table */}
      <TableContainer className="overflow-x-auto">
        <Table size="small" className="min-w-[1400px]">
          <TableHead>
            <TableRow>
              <TableCell
                className="!font-semibold !text-xs !text-gray-500"
                sortDirection={sort.column === "title" ? sort.direction : false}
              >
                <TableSortLabel
                  active={sort.column === "title"}
                  direction={sort.column === "title" ? sort.direction : "asc"}
                  onClick={() => handleSort("title")}
                >
                  Dream
                </TableSortLabel>
              </TableCell>
              <TableCell
                className="!font-semibold !text-xs !text-gray-500 !text-right"
                sortDirection={sort.column === "goal" ? sort.direction : false}
              >
                <TableSortLabel
                  active={sort.column === "goal"}
                  direction={sort.column === "goal" ? sort.direction : "asc"}
                  onClick={() => handleSort("goal")}
                >
                  Goal
                </TableSortLabel>
              </TableCell>
              <TableCell
                className="!font-semibold !text-xs !text-gray-500 !text-right"
                sortDirection={sort.column === "stretch" ? sort.direction : false}
              >
                <TableSortLabel
                  active={sort.column === "stretch"}
                  direction={sort.column === "stretch" ? sort.direction : "asc"}
                  onClick={() => handleSort("stretch")}
                >
                  Stretch
                </TableSortLabel>
              </TableCell>
              <TableCell
                className="!font-semibold !text-xs !text-gray-500 !text-right"
                sortDirection={sort.column === "funded" ? sort.direction : false}
              >
                <TableSortLabel
                  active={sort.column === "funded"}
                  direction={sort.column === "funded" ? sort.direction : "asc"}
                  onClick={() => handleSort("funded")}
                >
                  Funded
                </TableSortLabel>
              </TableCell>
              <TableCell
                className="!font-semibold !text-xs !text-gray-500 !text-right"
                sortDirection={sort.column === "missing" ? sort.direction : false}
              >
                <TableSortLabel
                  active={sort.column === "missing"}
                  direction={sort.column === "missing" ? sort.direction : "asc"}
                  onClick={() => handleSort("missing")}
                >
                  Missing
                </TableSortLabel>
              </TableCell>
              <TableCell
                className="!font-semibold !text-xs !text-gray-500 !text-right"
                sortDirection={sort.column === "funders" ? sort.direction : false}
              >
                <TableSortLabel
                  active={sort.column === "funders"}
                  direction={sort.column === "funders" ? sort.direction : "asc"}
                  onClick={() => handleSort("funders")}
                >
                  Funders
                </TableSortLabel>
              </TableCell>
              <TableCell
                className="!font-semibold !text-xs !text-gray-500 !text-right"
                sortDirection={sort.column === "progress" ? sort.direction : false}
              >
                <TableSortLabel
                  active={sort.column === "progress"}
                  direction={sort.column === "progress" ? sort.direction : "asc"}
                  onClick={() => handleSort("progress")}
                >
                  Progress
                </TableSortLabel>
              </TableCell>
              <TableCell className="!font-semibold !text-xs !text-gray-500">Fund</TableCell>
              <TableCell
                className="!font-semibold !text-xs !text-gray-500 !text-right"
                sortDirection={sort.column === "combo" ? sort.direction : false}
              >
                <TableSortLabel
                  active={sort.column === "combo"}
                  direction={sort.column === "combo" ? sort.direction : "asc"}
                  onClick={() => handleSort("combo")}
                >
                  M:Combo
                </TableSortLabel>
              </TableCell>
              <TableCell
                className="!font-semibold !text-xs !text-gray-500 !text-right"
                sortDirection={sort.column === "fundersModel" ? sort.direction : false}
              >
                <TableSortLabel
                  active={sort.column === "fundersModel"}
                  direction={sort.column === "fundersModel" ? sort.direction : "asc"}
                  onClick={() => handleSort("fundersModel")}
                >
                  M:Funders
                </TableSortLabel>
              </TableCell>
              <TableCell
                className="!font-semibold !text-xs !text-gray-500 !text-right"
                sortDirection={sort.column === "sek" ? sort.direction : false}
              >
                <TableSortLabel
                  active={sort.column === "sek"}
                  direction={sort.column === "sek" ? sort.direction : "asc"}
                  onClick={() => handleSort("sek")}
                >
                  M:SEK
                </TableSortLabel>
              </TableCell>
              <TableCell
                className="!font-semibold !text-xs !text-gray-500 !text-right"
                sortDirection={sort.column === "percent" ? sort.direction : false}
              >
                <TableSortLabel
                  active={sort.column === "percent"}
                  direction={sort.column === "percent" ? sort.direction : "asc"}
                  onClick={() => handleSort("percent")}
                >
                  M:Percent
                </TableSortLabel>
              </TableCell>
              <TableCell
                className="!font-semibold !text-xs !text-gray-500 !text-center"
                sortDirection={sort.column === "hearts" ? sort.direction : false}
              >
                <TableSortLabel
                  active={sort.column === "hearts"}
                  direction={sort.column === "hearts" ? sort.direction : "asc"}
                  onClick={() => handleSort("hearts")}
                >
                  Heart
                </TableSortLabel>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sorted.map((d) => {
              const progressPct = d.goal > 0 ? (d.funded / d.goal) * 100 : 0;
              const isFunded = d.funded >= d.goal;
              const heartCount = d.hearts?.length ?? 0;

              const getModelCell = (method: SortMethod) => {
                const st = modelResults[method];
                if (!st) return "—";
                const amt = st.amounts[d.bucket.id];
                return amt !== undefined ? amt : d.funded;
              };

              const getModelCellColor = (method: SortMethod) => {
                const st = modelResults[method];
                if (!st) return "";
                const amt = st.amounts[d.bucket.id];
                if (amt === undefined) return "";
                if (amt >= d.goal) return "bg-green-100";
                if (amt > 0) return "bg-yellow-50";
                return "";
              };

              return (
                <TableRow
                  key={d.bucket.id}
                  className={isFunded ? "bg-green-50" : "hover:bg-gray-50"}
                >
                  <TableCell className="!text-sm !font-medium max-w-[200px] truncate">
                    {d.bucket.title}
                  </TableCell>
                  <TableCell className="!text-sm !text-right">
                    <FormattedNumber value={d.goal} style="decimal" maximumFractionDigits={0} />
                  </TableCell>
                  <TableCell className="!text-sm !text-right">
                    <FormattedNumber value={d.stretch} style="decimal" maximumFractionDigits={0} />
                  </TableCell>
                  <TableCell className={`!text-sm !text-right ${isFunded ? "text-green-700 font-medium" : ""}`}>
                    <FormattedNumber value={d.funded} style="decimal" maximumFractionDigits={0} />
                  </TableCell>
                  <TableCell className={`!text-sm !text-right ${d.missing > 0 ? "text-red-600" : ""}`}>
                    {d.missing > 0 ? (
                      <>(<FormattedNumber value={d.missing} style="decimal" maximumFractionDigits={0} />)</>
                    ) : (
                      "0"
                    )}
                  </TableCell>
                  <TableCell className="!text-sm !text-right">{d.funders}</TableCell>
                  <TableCell className="!text-sm !text-right">
                    <span className={progressPct >= 100 ? "text-green-600 font-medium" : ""}>
                      {Math.round(progressPct)}%
                    </span>
                  </TableCell>
                  <TableCell className="!py-1">
                    <FundOverrideCell
                      bucketId={d.bucket.id}
                      override={overrides[d.bucket.id]?.override ?? "model"}
                      manualAmount={overrides[d.bucket.id]?.manualAmount}
                      onChangeOverride={(id, ov, amt) =>
                        setOverrides((prev) => ({
                          ...prev,
                          [id]: { override: ov, manualAmount: amt },
                        }))
                      }
                    />
                  </TableCell>
                  {(["combo", "funders", "sek", "percent"] as SortMethod[]).map((m) => (
                    <TableCell key={m} className={`!text-sm !text-right ${getModelCellColor(m)}`}>
                      {typeof getModelCell(m) === "number" ? (
                        <FormattedNumber value={getModelCell(m) as number} style="decimal" maximumFractionDigits={0} />
                      ) : (
                        getModelCell(m)
                      )}
                    </TableCell>
                  ))}
                  <TableCell className="!text-center">
                    <button
                      onClick={() => toggleHeart({ bucketId: d.bucket.id })}
                      className={`text-lg ${heartCount > 0 ? "text-red-500" : "text-gray-300 hover:text-red-300"}`}
                      title={heartCount > 0 ? `${heartCount} heart(s)` : "Heart this dream"}
                    >
                      {heartCount > 0 ? "♥" : "♡"}
                      {heartCount > 1 && <span className="text-xs ml-0.5">{heartCount}</span>}
                    </button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </div>
  );
}
