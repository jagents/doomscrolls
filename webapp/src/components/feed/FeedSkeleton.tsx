export function FeedSkeleton({ count = 3 }: { count?: number }) {
  return (
    <>
      {[...Array(count)].map((_, i) => (
        <div key={i} className="p-4 border-b border-border">
          {/* Text skeleton */}
          <div className="space-y-2 mb-4">
            <div className="h-4 skeleton rounded w-full" />
            <div className="h-4 skeleton rounded w-full" />
            <div className="h-4 skeleton rounded w-3/4" />
          </div>

          {/* Attribution skeleton */}
          <div className="flex items-center gap-2 mb-4">
            <div className="h-4 w-4 skeleton rounded" />
            <div className="h-4 w-32 skeleton rounded" />
            <div className="h-4 w-4 skeleton rounded" />
            <div className="h-4 w-24 skeleton rounded" />
          </div>

          {/* Actions skeleton */}
          <div className="flex items-center gap-8">
            <div className="h-8 w-16 skeleton rounded-full" />
            <div className="h-8 w-8 skeleton rounded-full" />
            <div className="h-8 w-8 skeleton rounded-full" />
          </div>
        </div>
      ))}
    </>
  );
}
