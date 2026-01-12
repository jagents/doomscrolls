import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { api } from '../services/api';
import { PassageCard } from '../components/feed/PassageCard';
import type { Passage } from '../types';

export function PassagePage() {
  const { id } = useParams<{ id: string }>();
  const [passage, setPassage] = useState<Passage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    setLoading(true);
    api.getPassage(id)
      .then(setPassage)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
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
          <Link to="/" className="p-2 hover:bg-secondary rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-bold">Passage</h1>
        </div>
      </div>

      {/* Passage */}
      <PassageCard passage={passage} />

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
