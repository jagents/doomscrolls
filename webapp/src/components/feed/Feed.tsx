import { useEffect, useRef, useCallback } from 'react';
import { PassageCard } from './PassageCard';
import { FeedSkeleton } from './FeedSkeleton';
import { useFeedStore } from '../../store/feedStore';

interface FeedProps {
  category?: string | null;
}

export function Feed({ category }: FeedProps) {
  const { passages, isLoading, hasMore, error, fetchMore, setCategory } = useFeedStore();
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Load feed when category changes
  useEffect(() => {
    setCategory(category || null);
  }, [category, setCategory]);

  // Infinite scroll observer
  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      if (entry.isIntersecting && hasMore && !isLoading) {
        fetchMore(category || undefined);
      }
    },
    [hasMore, isLoading, category, fetchMore]
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

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-500 mb-4">{error}</p>
        <button
          onClick={() => fetchMore(category || undefined)}
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
            <p className="text-xl mb-2">No passages found</p>
            <p className="text-secondary">Try a different category</p>
          </div>
        )}
      </div>
    </div>
  );
}
