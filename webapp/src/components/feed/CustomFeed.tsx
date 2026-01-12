import { useEffect, useRef, useCallback, useState } from 'react';
import { PassageCard } from './PassageCard';
import { FeedSkeleton } from './FeedSkeleton';
import type { Passage, FeedResponse } from '../../types';

interface CustomFeedProps {
  fetchFeed: (cursor: string | null) => Promise<FeedResponse>;
  emptyMessage?: string;
  emptySubtext?: string;
}

export function CustomFeed({
  fetchFeed,
  emptyMessage = 'No passages found',
  emptySubtext = 'Check back later for more content',
}: CustomFeedProps) {
  const [passages, setPassages] = useState<Passage[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const initialLoadDone = useRef(false);

  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await fetchFeed(cursor);
      setPassages((prev) => [...prev, ...result.passages]);
      setCursor(result.nextCursor);
      setHasMore(result.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load feed');
    } finally {
      setIsLoading(false);
    }
  }, [fetchFeed, cursor, isLoading, hasMore]);

  // Initial load
  useEffect(() => {
    if (!initialLoadDone.current) {
      initialLoadDone.current = true;
      loadMore();
    }
  }, [loadMore]);

  // Infinite scroll observer
  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      if (entry.isIntersecting && hasMore && !isLoading) {
        loadMore();
      }
    },
    [hasMore, isLoading, loadMore]
  );

  useEffect(() => {
    const observer = new IntersectionObserver(handleObserver, {
      rootMargin: '200px',
    });

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [handleObserver]);

  if (error && passages.length === 0) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-500 mb-4">{error}</p>
        <button
          onClick={loadMore}
          className="px-4 py-2 bg-accent text-white rounded-full hover:opacity-90"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div>
      {passages.map((passage) => (
        <PassageCard key={passage.id} passage={passage} />
      ))}

      {/* Loading / Load more trigger */}
      <div ref={loadMoreRef} className="p-4">
        {isLoading && <FeedSkeleton count={3} />}

        {!hasMore && passages.length > 0 && (
          <p className="text-center text-secondary py-8">
            You've reached the end. Refresh for more wisdom.
          </p>
        )}

        {!isLoading && passages.length === 0 && (
          <div className="text-center py-12">
            <p className="text-xl mb-2">{emptyMessage}</p>
            <p className="text-secondary">{emptySubtext}</p>
          </div>
        )}
      </div>
    </div>
  );
}
