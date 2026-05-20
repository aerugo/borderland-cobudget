import { useEffect, useRef, useState } from "react";

type OverrideType = "model" | "manual" | "skip" | "lock";

export default function FundOverrideCell({
  bucketId,
  override,
  manualAmount,
  onChangeOverride,
}: {
  bucketId: string;
  override: OverrideType;
  manualAmount: number | undefined;
  onChangeOverride: (
    bucketId: string,
    override: OverrideType,
    manualAmount?: number
  ) => void;
}) {
  const [localAmount, setLocalAmount] = useState(
    String(manualAmount ?? "")
  );
  const focusedRef = useRef(false);

  useEffect(() => {
    if (focusedRef.current) return;
    setLocalAmount(String(manualAmount ?? ""));
  }, [manualAmount]);

  return (
    <div className="flex items-center gap-1">
      <select
        value={override}
        onChange={(e) => {
          const val = e.target.value as OverrideType;
          onChangeOverride(
            bucketId,
            val,
            val === "manual" ? parseInt(localAmount, 10) || 0 : undefined
          );
        }}
        className="border rounded px-1 py-0.5 text-xs w-16"
      >
        <option value="model">Model</option>
        <option value="manual">Manual</option>
        <option value="skip">Skip</option>
        <option value="lock">Lock</option>
      </select>
      {override === "manual" && (
        <input
          type="number"
          value={localAmount}
          onChange={(e) => setLocalAmount(e.target.value)}
          onFocus={() => {
            focusedRef.current = true;
          }}
          onBlur={() => {
            focusedRef.current = false;
            onChangeOverride(
              bucketId,
              "manual",
              parseInt(localAmount, 10) || 0
            );
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onChangeOverride(
                bucketId,
                "manual",
                parseInt(localAmount, 10) || 0
              );
            }
          }}
          className="border rounded px-1 py-0.5 text-xs w-20"
        />
      )}
    </div>
  );
}
