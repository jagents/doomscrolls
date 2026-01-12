import { useEffect, useState } from 'react';
import { Bookmark } from 'lucide-react';
import { useUserStore } from '../store/userStore';
import { api } from '../services/api';
import { PassageCard } from '../components/feed/PassageCard';
import { FeedSkeleton } from '../components/feed/FeedSkeleton';
import type { Passage } from '../types';

export function BookmarksPage() {
  const { bookmarks } = useUserStore();
  const [passages, setPassages] = useState<Passage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (bookmarks.length === 0) {
      setPassages([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    // Fetch each bookmarked passage
    Promise.all(bookmarks.map((id) => api.getPassage(id).catch(() => null)))
      .then((results) => {
        setPassages(results.filter((p): p is Passage => p !== null));
      })
      .finally(() => setLoading(false));
  }, [bookmarks]);

  return (
    <div>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-primary/80 backdrop-blur border-b border-border px-4 py-4">
        <h1 className="text-xl font-bold">Bookmarks</h1>
      </div>

      {loading ? (
        <FeedSkeleton count={3} />
      ) : passages.length > 0 ? (
        <div>
          {passages.map((passage) => (
            <PassageCard key={passage.id} passage={passage} />
          ))}
        </div>
      ) : (
        <div className="p-8 text-center">
          <Bookmark className="w-16 h-16 mx-auto mb-4 text-secondary" />
          <h2 className="text-xl font-bold mb-2">No bookmarks yet</h2>
          <p className="text-secondary">
            Save passages you want to revisit by tapping the bookmark icon.
          </p>
        </div>
      )}
    </div>
  );
}
