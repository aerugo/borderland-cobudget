import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
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
import HeartCell from "./HeartCell";
import { SummarySkeleton, TableSkeleton } from "../LoadingSkeleton";
import {
  FreudDream,
  SortMethod,
  RedistributionState,
} from "utils/freud-redistribution";

type ColumnId =
  | "title"
  | "goal"
  | "stretch"
  | "funded"
  | "missing"
  | "funders"
  | "progress"
  | "fund"
  | "combo"
  | "fundersModel"
  | "sek"
  | "percent"
  | "hearts";

type SortColumn = Exclude<ColumnId, "fund">;

type ColumnConfig = {
  id: ColumnId;
  label: string;
  sortable: boolean;
  align: "left" | "right" | "center";
  defaultWidth: number;
  minWidth: number;
};

const COLUMNS: ColumnConfig[] = [
  { id: "title", label: "Dream", sortable: true, align: "left", defaultWidth: 240, minWidth: 80 },
  { id: "goal", label: "Goal", sortable: true, align: "right", defaultWidth: 90, minWidth: 60 },
  { id: "stretch", label: "Stretch", sortable: true, align: "right", defaultWidth: 90, minWidth: 60 },
  { id: "funded", label: "Funded", sortable: true, align: "right", defaultWidth: 90, minWidth: 60 },
  { id: "missing", label: "Missing", sortable: true, align: "right", defaultWidth: 90, minWidth: 60 },
  { id: "funders", label: "Funders", sortable: true, align: "right", defaultWidth: 80, minWidth: 60 },
  { id: "progress", label: "Progress", sortable: true, align: "right", defaultWidth: 90, minWidth: 60 },
  { id: "fund", label: "Fund", sortable: false, align: "left", defaultWidth: 160, minWidth: 100 },
  { id: "combo", label: "M:Combo", sortable: true, align: "right", defaultWidth: 90, minWidth: 60 },
  { id: "fundersModel", label: "M:Funders", sortable: true, align: "right", defaultWidth: 100, minWidth: 60 },
  { id: "sek", label: "M:SEK", sortable: true, align: "right", defaultWidth: 90, minWidth: 60 },
  { id: "percent", label: "M:Percent", sortable: true, align: "right", defaultWidth: 100, minWidth: 60 },
  { id: "hearts", label: "Heart", sortable: true, align: "center", defaultWidth: 80, minWidth: 60 },
];

const COLUMN_PREFS_KEY = "freud-redistribution-columns:v1";

const defaultWidths = (): Record<ColumnId, number> =>
  COLUMNS.reduce((acc, c) => {
    acc[c.id] = c.defaultWidth;
    return acc;
  }, {} as Record<ColumnId, number>);

function alignClass(align: "left" | "right" | "center"): string {
  if (align === "right") return "!text-right";
  if (align === "center") return "!text-center";
  return "";
}

function ResizableHeaderCell({
  col,
  width,
  sort,
  onSort,
  onResizeStart,
}: {
  col: ColumnConfig;
  width: number;
  sort: { column: SortColumn; direction: "asc" | "desc" };
  onSort: (id: SortColumn) => void;
  onResizeStart: (id: ColumnId, e: React.MouseEvent) => void;
}) {
  const sortable = col.sortable;
  const sortId = col.id as SortColumn;
  return (
    <TableCell
      style={{ width, minWidth: width, maxWidth: width, position: "relative" }}
      className={`!font-semibold !text-xs !text-gray-500 ${alignClass(col.align)}`}
      sortDirection={sortable && sort.column === sortId ? sort.direction : false}
    >
      {sortable ? (
        <TableSortLabel
          active={sort.column === sortId}
          direction={sort.column === sortId ? sort.direction : "asc"}
          onClick={() => onSort(sortId)}
        >
          {col.label}
        </TableSortLabel>
      ) : (
        col.label
      )}
      <div
        onMouseDown={(e) => onResizeStart(col.id, e)}
        onClick={(e) => e.stopPropagation()}
        className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-blue-400 active:bg-blue-500 select-none"
        style={{ userSelect: "none" }}
        title="Drag to resize"
      />
    </TableCell>
  );
}

export const FREUD_DATA_QUERY = gql`
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

export const FREUD_OVERRIDES_QUERY = gql`
  query FreudOverrides($roundId: ID!) {
    freudOverrides(roundId: $roundId) {
      id
      bucketId
      type
      manualAmount
      updatedAt
      updatedBy {
        id
        user {
          id
          username
          name
        }
      }
    }
  }
`;

const SET_FREUD_OVERRIDE = gql`
  mutation SetFreudOverride(
    $roundId: ID!
    $bucketId: ID!
    $type: String!
    $manualAmount: Int
  ) {
    setFreudOverride(
      roundId: $roundId
      bucketId: $bucketId
      type: $type
      manualAmount: $manualAmount
    ) {
      id
      bucketId
      type
      manualAmount
      updatedAt
      updatedBy {
        id
        user {
          id
          username
          name
        }
      }
    }
  }
`;

const CLEAR_FREUD_OVERRIDE = gql`
  mutation ClearFreudOverride($roundId: ID!, $bucketId: ID!) {
    clearFreudOverride(roundId: $roundId, bucketId: $bucketId)
  }
`;

const TOGGLE_HEART = gql`
  mutation ToggleFreudHeart($bucketId: ID!) {
    toggleFreudHeart(bucketId: $bucketId) {
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
  }
`;

const OVERRIDES_POLL_MS = 4000;

const MODELS: { method: SortMethod; label: string; description: string }[] = [
  { method: "combo", label: "Combo", description: "Rank by A+B+C combo" },
  { method: "funders", label: "Funders", description: "Rank by funder count" },
  { method: "sek", label: "SEK", description: "Rank by SEK left to goal" },
  { method: "percent", label: "Percent", description: "Rank by % left to goal" },
];

export default function RedistributionPage({
  round,
  currentUser,
  groupSlug,
  roundSlug,
}: {
  round: any;
  currentUser: any;
  groupSlug: string;
  roundSlug: string;
}) {
  const [result] = useQuery({
    query: FREUD_DATA_QUERY,
    variables: { roundId: round.id },
    pause: !round?.id,
  });

  const [overridesResult, reexecuteOverrides] = useQuery({
    query: FREUD_OVERRIDES_QUERY,
    variables: { roundId: round.id },
    pause: !round?.id,
    requestPolicy: "cache-and-network",
  });

  useEffect(() => {
    if (!round?.id) return;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (intervalId !== null) return;
      intervalId = setInterval(() => {
        if (typeof document !== "undefined" && document.hidden) return;
        reexecuteOverrides({ requestPolicy: "network-only" });
      }, OVERRIDES_POLL_MS);
    };
    const stop = () => {
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };
    const onVisibility = () => {
      if (document.hidden) {
        stop();
      } else {
        reexecuteOverrides({ requestPolicy: "network-only" });
        start();
      }
    };
    if (typeof document !== "undefined" && document.hidden) {
      // wait until tab becomes visible
    } else {
      start();
    }
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibility);
    }
    return () => {
      stop();
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibility);
      }
    };
  }, [round?.id, reexecuteOverrides]);

  const [, toggleHeart] = useMutation(TOGGLE_HEART);
  const [, setOverrideMutation] = useMutation(SET_FREUD_OVERRIDE);
  const [, clearOverrideMutation] = useMutation(CLEAR_FREUD_OVERRIDE);
  const [showFunded, setShowFunded] = useState(false);
  const topScrollRef = useRef<HTMLDivElement | null>(null);
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const syncingFrom = useRef<"top" | "bottom" | null>(null);
  const [modelResults, setModelResults] = useState<
    Record<SortMethod, RedistributionState | null>
  >({
    combo: null,
    funders: null,
    sek: null,
    percent: null,
  });

  const overrides: Record<
    string,
    { override: "model" | "manual" | "skip" | "lock"; manualAmount?: number }
  > = useMemo(() => {
    const map: Record<
      string,
      { override: "model" | "manual" | "skip" | "lock"; manualAmount?: number }
    > = {};
    const rows = overridesResult.data?.freudOverrides ?? [];
    for (const r of rows) {
      const t = r.type as "manual" | "skip" | "lock";
      map[r.bucketId] = {
        override: t,
        manualAmount: t === "manual" ? r.manualAmount ?? undefined : undefined,
      };
    }
    return map;
  }, [overridesResult.data]);

  const handleChangeOverride = useCallback(
    (
      bucketId: string,
      override: "model" | "manual" | "skip" | "lock",
      manualAmount?: number
    ) => {
      if (override === "model") {
        clearOverrideMutation({ roundId: round.id, bucketId });
      } else {
        setOverrideMutation({
          roundId: round.id,
          bucketId,
          type: override,
          manualAmount: override === "manual" ? manualAmount ?? 0 : null,
        });
      }
    },
    [round?.id, setOverrideMutation, clearOverrideMutation]
  );

  const [columnWidths, setColumnWidths] =
    useState<Record<ColumnId, number>>(defaultWidths);
  const [hiddenColumns, setHiddenColumns] = useState<Set<ColumnId>>(new Set());
  const [columnsMenuOpen, setColumnsMenuOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const columnsMenuRef = useRef<HTMLDivElement | null>(null);
  const prefsLoaded = useRef(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(COLUMN_PREFS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          widths?: Partial<Record<ColumnId, number>>;
          hidden?: ColumnId[];
        };
        if (parsed.widths) {
          setColumnWidths((prev) => ({ ...prev, ...parsed.widths }));
        }
        if (Array.isArray(parsed.hidden)) {
          setHiddenColumns(new Set(parsed.hidden));
        }
      }
    } catch {
      // ignore corrupted prefs
    }
    prefsLoaded.current = true;
  }, []);

  useEffect(() => {
    if (!prefsLoaded.current) return;
    try {
      window.localStorage.setItem(
        COLUMN_PREFS_KEY,
        JSON.stringify({
          widths: columnWidths,
          hidden: Array.from(hiddenColumns),
        })
      );
    } catch {
      // ignore quota errors
    }
  }, [columnWidths, hiddenColumns]);

  useEffect(() => {
    if (!columnsMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        columnsMenuRef.current &&
        !columnsMenuRef.current.contains(e.target as Node)
      ) {
        setColumnsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [columnsMenuOpen]);

  const handleResizeStart = useCallback(
    (id: ColumnId, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const col = COLUMNS.find((c) => c.id === id);
      if (!col) return;
      const startX = e.clientX;
      const startWidth = columnWidths[id] ?? col.defaultWidth;
      const onMove = (ev: MouseEvent) => {
        const next = Math.max(col.minWidth, startWidth + (ev.clientX - startX));
        setColumnWidths((prev) => ({ ...prev, [id]: next }));
      };
      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [columnWidths]
  );

  const toggleColumnVisibility = useCallback((id: ColumnId) => {
    setHiddenColumns((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const resetColumns = useCallback(() => {
    setColumnWidths(defaultWidths());
    setHiddenColumns(new Set());
  }, []);

  const isVisible = useCallback(
    (id: ColumnId) => !hiddenColumns.has(id),
    [hiddenColumns]
  );
  const widthStyle = useCallback(
    (id: ColumnId): React.CSSProperties => {
      const w = columnWidths[id];
      return { width: w, minWidth: w, maxWidth: w };
    },
    [columnWidths]
  );

  const visibleColumns = useMemo(
    () => COLUMNS.filter((c) => !hiddenColumns.has(c.id)),
    [hiddenColumns]
  );
  const totalVisibleWidth = useMemo(
    () => visibleColumns.reduce((sum, c) => sum + (columnWidths[c.id] ?? c.defaultWidth), 0),
    [visibleColumns, columnWidths]
  );

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
  const currentMemberId: string | null =
    currentUser?.currentCollMember?.id ?? null;

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
      {/* Help / Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg mb-4">
        <button
          onClick={() => setHelpOpen((o) => !o)}
          className="w-full flex items-center justify-between px-4 py-3 text-left text-sm font-medium text-blue-900 hover:bg-blue-100 rounded-lg"
          aria-expanded={helpOpen}
        >
          <span className="flex items-center gap-2">
            <span className="text-base">?</span>
            How redistribution works
          </span>
          <span className="text-xs text-blue-700">
            {helpOpen ? "Hide" : "Show"}
          </span>
        </button>
        {helpOpen && (
          <div className="px-4 pb-4 pt-1 text-sm text-gray-700 space-y-4 border-t border-blue-200">
            <section>
              <h3 className="font-semibold text-gray-900 mb-1">The big picture</h3>
              <p>
                Each model takes the round&apos;s total budget and tries to fully
                fund as many eligible dreams as possible, in priority order. A
                dream is &quot;funded&quot; only when its allocation reaches its goal —
                partial allocations are not made. Dreams already at goal in the
                granting phase keep their funded amount and are excluded from
                redistribution. The leftover money after redistribution is the
                model&apos;s pot at zero; whatever cannot be allocated stays in the
                pot.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-gray-900 mb-1">The four ranking models</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <span className="font-medium">Funders</span> — sorts dreams by
                  number of distinct funders, descending. Rewards broad
                  community support.
                </li>
                <li>
                  <span className="font-medium">SEK</span> — sorts by absolute
                  amount left to goal (goal − funded), ascending. Cheapest-to-
                  finish dreams come first.
                </li>
                <li>
                  <span className="font-medium">Percent</span> — sorts by share
                  of goal already raised, descending. Closest-to-finish dreams
                  come first.
                </li>
                <li>
                  <span className="font-medium">Combo</span> — sums each
                  dream&apos;s rank in the three lists above and sorts ascending.
                  A dream that scores well across all three rises to the top.
                </li>
              </ul>
              <p className="mt-1 text-xs text-gray-500">
                Ties are broken alphabetically by dream title.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-gray-900 mb-1">Run, Loop, and Reset</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <span className="font-medium">Run (Loop off)</span> — performs
                  one step. The first step funds dreams from the top of the
                  ranking until the pot can&apos;t cover the next dream&apos;s remaining
                  need. Each later step defunds the most recently funded dream
                  (returning its allocation to the pot) and then tries to fund
                  forward from where it stopped. This lets you watch a single
                  swap at a time.
                </li>
                <li>
                  <span className="font-medium">Run (Loop on, &quot;Run all&quot;)</span> —
                  steps repeatedly until the model is complete: no further
                  defund-then-fund swap can help. The pot at that point is what
                  the model couldn&apos;t allocate.
                </li>
                <li>
                  <span className="font-medium">Reset</span> — clears the
                  model&apos;s state. Allocations, the pot, and the step history all
                  return to their starting values, and the model is ready to
                  run again with the current overrides and budget.
                </li>
                <li>
                  <span className="font-medium">Done</span> — appears in place
                  of Run when the model has nothing left to do.
                </li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold text-gray-900 mb-1">Per-dream overrides (the Fund column)</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <span className="font-medium">Model</span> — default; the
                  dream is eligible and ranked by the active model.
                </li>
                <li>
                  <span className="font-medium">Manual</span> — you set a fixed
                  amount. That amount is locked in and removed from the pot
                  before the model runs.
                </li>
                <li>
                  <span className="font-medium">Skip</span> — the dream is
                  excluded from redistribution and gets 0 from the model.
                </li>
                <li>
                  <span className="font-medium">Lock</span> — the dream&apos;s goal
                  is funded in full and removed from the pot before the model
                  runs.
                </li>
              </ul>
              <p className="mt-1 text-xs text-gray-500">
                Changing overrides does not auto-rerun any model. Press Reset
                and Run on a model to see the new result.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-gray-900 mb-1">Reading the table</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <span className="font-medium">Goal / Stretch / Funded / Missing</span> —
                  current state from granting. Missing is goal − funded.
                </li>
                <li>
                  <span className="font-medium">Funders</span> — distinct
                  funders during granting.
                </li>
                <li>
                  <span className="font-medium">M:Combo / M:Funders / M:SEK / M:Percent</span> —
                  what each model would allocate to this dream after Run/Loop.
                  Green cell = funded to goal; yellow = partial (only for
                  manual overrides, since the algorithm itself is all-or-
                  nothing); blank = nothing yet.
                </li>
                <li>
                  <span className="font-medium">Heart</span> — admins/mods can
                  star dreams they want to advocate for. Hearts are advisory:
                  they do not influence the algorithm, only sorting.
                </li>
                <li>
                  <span className="font-medium">Next +/−</span> (per model row) —
                  the dream the model would fund next on Run, and the dream it
                  would defund next.
                </li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold text-gray-900 mb-1">View controls</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <span className="font-medium">Show dreams that reached goal in granting</span> —
                  toggles whether already-funded dreams appear in the table.
                  They are always included in the model&apos;s totals regardless.
                </li>
                <li>
                  <span className="font-medium">Columns</span> — show, hide, or
                  resize columns. Drag the right edge of any header to resize.
                  Preferences persist in your browser.
                </li>
                <li>
                  <span className="font-medium">Export CSV</span> — downloads
                  the current visible rows with all model amounts.
                </li>
                <li>
                  <span className="font-medium">Dream titles</span> — open the
                  dream page in a new tab.
                </li>
              </ul>
            </section>
          </div>
        )}
      </div>

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
        <div className="relative" ref={columnsMenuRef}>
          <button
            onClick={() => setColumnsMenuOpen((o) => !o)}
            className="text-sm text-blue-600 hover:underline"
          >
            Columns ({visibleColumns.length}/{COLUMNS.length})
          </button>
          {columnsMenuOpen && (
            <div className="absolute z-20 mt-1 bg-white border rounded-lg shadow-lg p-2 min-w-[200px] max-h-[400px] overflow-y-auto">
              {COLUMNS.map((c) => (
                <label
                  key={c.id}
                  className="flex items-center gap-2 text-sm py-1 px-1 cursor-pointer hover:bg-gray-50 rounded"
                >
                  <input
                    type="checkbox"
                    checked={!hiddenColumns.has(c.id)}
                    onChange={() => toggleColumnVisibility(c.id)}
                  />
                  {c.label}
                </label>
              ))}
              <button
                onClick={resetColumns}
                className="text-xs text-blue-600 hover:underline mt-2 px-1"
              >
                Reset all
              </button>
            </div>
          )}
        </div>
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
      <div
        ref={topScrollRef}
        onScroll={() => {
          if (syncingFrom.current === "bottom") {
            syncingFrom.current = null;
            return;
          }
          syncingFrom.current = "top";
          if (tableScrollRef.current && topScrollRef.current) {
            tableScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft;
          }
        }}
        className="overflow-x-auto"
        style={{ overflowY: "hidden" }}
      >
        <div style={{ minWidth: totalVisibleWidth, height: 1 }} />
      </div>
      <TableContainer
        ref={tableScrollRef}
        onScroll={() => {
          if (syncingFrom.current === "top") {
            syncingFrom.current = null;
            return;
          }
          syncingFrom.current = "bottom";
          if (tableScrollRef.current && topScrollRef.current) {
            topScrollRef.current.scrollLeft = tableScrollRef.current.scrollLeft;
          }
        }}
        className="overflow-x-auto"
      >
        <Table
          size="small"
          style={{ tableLayout: "fixed", minWidth: totalVisibleWidth, width: totalVisibleWidth }}
        >
          <TableHead>
            <TableRow>
              {visibleColumns.map((col) => (
                <ResizableHeaderCell
                  key={col.id}
                  col={col}
                  width={columnWidths[col.id] ?? col.defaultWidth}
                  sort={sort}
                  onSort={handleSort}
                  onResizeStart={handleResizeStart}
                />
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {sorted.map((d) => {
              const progressPct = d.goal > 0 ? (d.funded / d.goal) * 100 : 0;
              const isFunded = d.funded >= d.goal;

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

              const modelMethodFor: Record<
                "combo" | "fundersModel" | "sek" | "percent",
                SortMethod
              > = {
                combo: "combo",
                fundersModel: "funders",
                sek: "sek",
                percent: "percent",
              };

              return (
                <TableRow
                  key={d.bucket.id}
                  className={isFunded ? "bg-green-50" : "hover:bg-gray-50"}
                >
                  {isVisible("title") && (
                    <TableCell
                      style={widthStyle("title")}
                      className="!text-sm !font-medium"
                    >
                      <Link
                        href={`/${groupSlug}/${roundSlug}/${d.bucket.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline text-blue-700 truncate block"
                      >
                        {d.bucket.title}
                      </Link>
                    </TableCell>
                  )}
                  {isVisible("goal") && (
                    <TableCell style={widthStyle("goal")} className="!text-sm !text-right">
                      <FormattedNumber value={d.goal} style="decimal" maximumFractionDigits={0} />
                    </TableCell>
                  )}
                  {isVisible("stretch") && (
                    <TableCell style={widthStyle("stretch")} className="!text-sm !text-right">
                      <FormattedNumber value={d.stretch} style="decimal" maximumFractionDigits={0} />
                    </TableCell>
                  )}
                  {isVisible("funded") && (
                    <TableCell
                      style={widthStyle("funded")}
                      className={`!text-sm !text-right ${isFunded ? "text-green-700 font-medium" : ""}`}
                    >
                      <FormattedNumber value={d.funded} style="decimal" maximumFractionDigits={0} />
                    </TableCell>
                  )}
                  {isVisible("missing") && (
                    <TableCell
                      style={widthStyle("missing")}
                      className={`!text-sm !text-right ${d.missing > 0 ? "text-red-600" : ""}`}
                    >
                      {d.missing > 0 ? (
                        <>(<FormattedNumber value={d.missing} style="decimal" maximumFractionDigits={0} />)</>
                      ) : (
                        "0"
                      )}
                    </TableCell>
                  )}
                  {isVisible("funders") && (
                    <TableCell style={widthStyle("funders")} className="!text-sm !text-right">
                      {d.funders}
                    </TableCell>
                  )}
                  {isVisible("progress") && (
                    <TableCell style={widthStyle("progress")} className="!text-sm !text-right">
                      <span className={progressPct >= 100 ? "text-green-600 font-medium" : ""}>
                        {Math.round(progressPct)}%
                      </span>
                    </TableCell>
                  )}
                  {isVisible("fund") && (
                    <TableCell style={widthStyle("fund")} className="!py-1">
                      <FundOverrideCell
                        bucketId={d.bucket.id}
                        override={overrides[d.bucket.id]?.override ?? "model"}
                        manualAmount={overrides[d.bucket.id]?.manualAmount}
                        onChangeOverride={handleChangeOverride}
                      />
                    </TableCell>
                  )}
                  {(["combo", "fundersModel", "sek", "percent"] as const).map((cid) =>
                    isVisible(cid) ? (
                      <TableCell
                        key={cid}
                        style={widthStyle(cid)}
                        className={`!text-sm !text-right ${getModelCellColor(modelMethodFor[cid])}`}
                      >
                        {typeof getModelCell(modelMethodFor[cid]) === "number" ? (
                          <FormattedNumber
                            value={getModelCell(modelMethodFor[cid]) as number}
                            style="decimal"
                            maximumFractionDigits={0}
                          />
                        ) : (
                          getModelCell(modelMethodFor[cid])
                        )}
                      </TableCell>
                    ) : null
                  )}
                  {isVisible("hearts") && (
                    <TableCell style={widthStyle("hearts")} className="!text-center">
                      <HeartCell
                        hearts={d.hearts ?? []}
                        currentMemberId={currentMemberId}
                        onToggle={() => toggleHeart({ bucketId: d.bucket.id })}
                      />
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </div>
  );
}
