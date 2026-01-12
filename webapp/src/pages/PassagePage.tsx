import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, Loader2 } from 'lucide-react';
import { api } from '../services/api';
import { PassageCard } from '../components/feed/PassageCard';
import type { Passage, SimilarPassage } from '../types';

export function PassagePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [passage, setPassage] = useState<Passage | null>(null);
  const [similarPassages, setSimilarPassages] = useState<SimilarPassage[]>([]);
  const [similarMethod, setSimilarMethod] = useState<'embedding' | 'fallback'>('fallback');
  const [loading, setLoading] = useState(true);
  const [similarLoading, setSimilarLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    setLoading(true);
    api.getPassage(id)
      .then(setPassage)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));

    // Load similar passages
    setSimilarLoading(true);
    api.getSimilarPassages(id, 5)
      .then((result) => {
        setSimilarPassages(result.similar);
        setSimilarMethod(result.method);
      })
      .catch(console.error)
      .finally(() => setSimilarLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="p-8">
        <div className="h-32 skeleton rounded-xl" />
      </div>
    );
  }

  if (error || !passage) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-500 mb-4">{error || 'Passage not found'}</p>
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
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-secondary rounded-full"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold">Passage</h1>
        </div>
      </div>

      {/* Main Passage */}
      <PassageCard passage={passage} />

      {/* More Like This Section */}
      <div className="border-t border-border">
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-accent" />
            <h3 className="font-bold">More Like This</h3>
            {similarMethod === 'embedding' && (
              <span className="text-xs px-2 py-0.5 bg-accent/20 text-accent rounded-full">
                AI-powered
              </span>
            )}
          </div>
          <p className="text-sm text-secondary mt-1">
            {similarMethod === 'embedding'
              ? 'Passages with similar themes and style'
              : 'More from this author and work'}
          </p>
        </div>

        {similarLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-accent" />
          </div>
        ) : similarPassages.length > 0 ? (
          <div>
            {similarPassages.map((similar) => (
              <Link
                key={similar.id}
                to={`/passage/${similar.id}`}
                className="block border-b border-border hover:bg-secondary/50 transition-colors"
              >
                <div className="p-4">
                  <p
                    className="text-primary line-clamp-3 mb-2"
                    style={{ fontFamily: 'Georgia, serif' }}
                  >
                    {similar.text}
                  </p>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-secondary">
                      {similar.author.name}
                      {similar.work && ` - ${similar.work.title}`}
                    </span>
                    {similarMethod === 'embedding' && (
                      <span className="text-muted">
                        {(parseFloat(similar.similarity) * 100).toFixed(0)}% similar
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-secondary">
            No similar passages found
          </div>
        )}
      </div>

      {/* CTA */}
      <div className="p-4 text-center border-t border-border">
        <Link
          to="/"
          className="inline-block px-6 py-3 bg-accent text-white rounded-full font-bold hover:opacity-90 transition-opacity"
        >
          Start Scrolling
        </Link>
      </div>
    </div>
  );
}
