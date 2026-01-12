import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, ExternalLink, BookOpen } from 'lucide-react';
import { api } from '../services/api';
import { PassageCard } from '../components/feed/PassageCard';
import { FeedSkeleton } from '../components/feed/FeedSkeleton';
import type { WorkDetail, Passage } from '../types';

export function WorkPage() {
  const { slug } = useParams<{ slug: string }>();
  const [work, setWork] = useState<WorkDetail | null>(null);
  const [passages, setPassages] = useState<Passage[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;

    setLoading(true);
    setError(null);

    Promise.all([
      api.getWork(slug),
      api.getWorkPassages(slug, { limit: 20 }),
    ])
      .then(([workRes, passagesRes]) => {
        setWork(workRes);
        setPassages(passagesRes.passages);
        setTotal(passagesRes.total);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div>
        <div className="p-4 border-b border-border">
          <div className="h-8 w-48 skeleton rounded mb-4" />
          <div className="h-4 w-32 skeleton rounded" />
        </div>
        <FeedSkeleton count={3} />
      </div>
    );
  }

  if (error || !work) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-500 mb-4">{error || 'Work not found'}</p>
        <Link to="/" className="text-accent hover:underline">
          Back to Home
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-primary/80 backdrop-blur border-b border-border px-4 py-3">
        <div className="flex items-center gap-4">
          <Link to="/" className="p-2 hover:bg-secondary rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold">{work.title}</h1>
            <p className="text-sm text-secondary">
              {total} passages
            </p>
          </div>
        </div>
      </div>

      {/* Work Info */}
      <div className="p-4 border-b border-border">
        <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: 'Georgia, serif' }}>
          {work.title}
        </h2>
        <div className="text-secondary space-y-1">
          <p>
            by{' '}
            <Link
              to={`/author/${work.author_slug}`}
              className="text-primary hover:underline"
            >
              {work.author_name}
            </Link>
          </p>
          {work.year && <p>Published: {work.year}</p>}
          {work.type && <p>Type: {work.type}</p>}
          {work.genre && <p>Genre: {work.genre}</p>}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 mt-4">
          <Link
            to={`/work/${slug}/read`}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent hover:bg-accent-hover text-white font-semibold rounded-full transition-colors"
          >
            <BookOpen className="w-5 h-5" />
            Read Full Work
          </Link>

          {work.source_url && (
            <a
              href={work.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-secondary hover:bg-hover rounded-full transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Source
            </a>
          )}
        </div>
      </div>

      {/* Passages */}
      <div>
        <h3 className="font-bold p-4 border-b border-border">
          Passages
          {total > passages.length && (
            <span className="font-normal text-secondary ml-2">
              (showing {passages.length} of {total})
            </span>
          )}
        </h3>
        {passages.map((passage) => (
          <PassageCard key={passage.id} passage={passage} />
        ))}
        {passages.length === 0 && (
          <p className="p-4 text-center text-secondary">No passages available</p>
        )}
      </div>
    </div>
  );
}
