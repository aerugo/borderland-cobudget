export function TableSkeleton({ rows = 8, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="animate-pulse">
      {/* Header */}
      <div className="flex gap-3 mb-3 px-2">
        {Array.from({ length: cols }).map((_, i) => (
          <div
            key={i}
            className="h-3 bg-gray-200 rounded"
            style={{ width: `${60 + Math.random() * 80}px` }}
          />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div
          key={rowIdx}
          className="flex gap-3 py-3 px-2 border-b border-gray-100"
        >
          {Array.from({ length: cols }).map((_, colIdx) => (
            <div
              key={colIdx}
              className="h-4 bg-gray-100 rounded"
              style={{ width: `${40 + Math.random() * 100}px` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SummarySkeleton() {
  return (
    <div className="animate-pulse bg-white border rounded-lg p-4 mb-4">
      <div className="flex flex-wrap gap-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="space-y-1">
            <div className="h-3 w-20 bg-gray-200 rounded" />
            <div className="h-4 w-28 bg-gray-100 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function CardListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="animate-pulse space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white border rounded-lg p-4 space-y-2">
          <div className="h-4 w-48 bg-gray-200 rounded" />
          <div className="h-3 w-64 bg-gray-100 rounded" />
          <div className="h-3 w-36 bg-gray-100 rounded" />
        </div>
      ))}
    </div>
  );
}
