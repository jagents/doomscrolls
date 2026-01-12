import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { api } from '../services/api';
import { PassageCard } from '../components/feed/PassageCard';
import { FeedSkeleton } from '../components/feed/FeedSkeleton';
import type { AuthorDetail, Passage } from '../types';

export function AuthorPage() {
  const { slug } = useParams<{ slug: string }>();
  const [author, setAuthor] = useState<AuthorDetail | null>(null);
  const [passages, setPassages] = useState<Passage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;

    setLoading(true);
    setError(null);

    Promise.all([
      api.getAuthor(slug),
      api.getAuthorPassages(slug, { limit: 10 }),
    ])
      .then(([authorRes, passagesRes]) => {
        setAuthor(authorRes);
        setPassages(passagesRes.passages);
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

  if (error || !author) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-500 mb-4">{error || 'Author not found'}</p>
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
            <h1 className="text-xl font-bold">{author.name}</h1>
            <p className="text-sm text-secondary">
              {author.works?.length || 0} works
            </p>
          </div>
        </div>
      </div>

      {/* Author Info */}
      <div className="p-4 border-b border-border">
        <div className="flex items-start gap-4">
          <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center text-3xl font-bold">
            {author.name.charAt(0)}
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold mb-1">{author.name}</h2>
            <div className="text-secondary space-x-2">
              {author.birth_year && author.death_year && (
                <span>{author.birth_year} - {author.death_year}</span>
              )}
              {author.era && <span>({author.era})</span>}
              {author.nationality && <span>| {author.nationality}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Works */}
      {author.works && author.works.length > 0 && (
        <div className="p-4 border-b border-border">
          <h3 className="font-bold mb-3">Works</h3>
          <div className="flex flex-wrap gap-2">
            {author.works.map((work) => (
              <Link
                key={work.id}
                to={`/work/${work.slug}`}
                className="px-3 py-1.5 bg-secondary hover:bg-tertiary rounded-full text-sm transition-colors"
              >
                {work.title}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Passages */}
      <div>
        <h3 className="font-bold p-4 border-b border-border">Passages</h3>
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
