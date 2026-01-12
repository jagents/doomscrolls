import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2, BookOpen } from 'lucide-react';
import { api } from '../services/api';
import { useAuthStore } from '../store/authStore';

interface WorkInfo {
  id: string;
  title: string;
  slug: string;
  year: number | null;
  type: string | null;
  genre: string | null;
  author: { name: string; slug: string };
}

interface Chunk {
  id: string;
  text: string;
  type: string;
  index: number;
}

export function ReaderPage() {
  const { slug } = useParams<{ slug: string }>();
  const { isAuthenticated } = useAuthStore();

  const [work, setWork] = useState<WorkInfo | null>(null);
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [totalChunks, setTotalChunks] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const contentRef = useRef<HTMLDivElement>(null);
  const progressSaveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load work info
  useEffect(() => {
    if (!slug) return;

    const loadWork = async () => {
      try {
        const result = await api.getWorkForReading(slug);
        setWork(result.work);
        setTotalChunks(result.totalChunks);

        // Resume from saved progress if available
        if (result.userProgress) {
          setCurrentIndex(result.userProgress.currentIndex);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load work');
      }
    };

    loadWork();
  }, [slug]);

  // Load chunks around current position
  const loadChunks = useCallback(async (startIndex: number) => {
    if (!slug) return;

    setIsLoading(true);
    try {
      const result = await api.getWorkChunks(slug, {
        start: Math.max(0, startIndex - 2),
        limit: 10,
      });
      setChunks(result.chunks);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load content');
    } finally {
      setIsLoading(false);
    }
  }, [slug]);

  // Load chunks when current index changes significantly
  useEffect(() => {
    const needsLoad = chunks.length === 0 ||
      currentIndex < chunks[0]?.index ||
      currentIndex > chunks[chunks.length - 1]?.index;

    if (needsLoad) {
      loadChunks(currentIndex);
    }
  }, [currentIndex, chunks, loadChunks]);

  // Save progress (debounced)
  useEffect(() => {
    if (!isAuthenticated() || !slug) return;

    if (progressSaveTimeout.current) {
      clearTimeout(progressSaveTimeout.current);
    }

    progressSaveTimeout.current = setTimeout(() => {
      api.updateReadingProgress(slug, currentIndex).catch(console.error);
    }, 2000);

    return () => {
      if (progressSaveTimeout.current) {
        clearTimeout(progressSaveTimeout.current);
      }
    };
  }, [currentIndex, slug, isAuthenticated]);

  // Scroll to top when changing chunks
  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentIndex]);

  const currentChunk = chunks.find((c) => c.index === currentIndex);
  const progress = totalChunks > 0 ? Math.round((currentIndex / (totalChunks - 1)) * 100) : 0;

  const goToPrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const goToNext = () => {
    if (currentIndex < totalChunks - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goToPrevious();
      if (e.key === 'ArrowRight') goToNext();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, totalChunks]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <Link to={`/work/${slug}`} className="text-accent hover:underline">
            Back to work
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-primary">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-primary/95 backdrop-blur border-b border-border">
        <div className="flex items-center justify-between px-4 py-3">
          <Link
            to={`/work/${slug}`}
            className="p-2 -ml-2 rounded-full hover:bg-secondary transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>

          <div className="flex-1 text-center px-4">
            <p className="font-semibold text-primary truncate">{work?.title}</p>
            <p className="text-sm text-secondary">{work?.author.name}</p>
          </div>

          <div className="text-sm text-secondary">
            {currentIndex + 1} / {totalChunks}
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-secondary">
          <div
            className="h-full bg-accent transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </header>

      {/* Content */}
      <div
        ref={contentRef}
        className="flex-1 overflow-y-auto px-4 py-8 max-w-2xl mx-auto w-full"
      >
        {isLoading && !currentChunk ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-accent" />
          </div>
        ) : currentChunk ? (
          <div className="prose prose-invert max-w-none">
            <p
              className="text-lg leading-relaxed whitespace-pre-wrap"
              style={{ fontFamily: 'Georgia, serif' }}
            >
              {currentChunk.text}
            </p>
          </div>
        ) : (
          <div className="text-center py-12">
            <BookOpen className="w-12 h-12 mx-auto mb-4 text-muted" />
            <p className="text-secondary">Loading content...</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="sticky bottom-0 bg-primary/95 backdrop-blur border-t border-border">
        <div className="flex items-center justify-between px-4 py-3 max-w-2xl mx-auto">
          <button
            onClick={goToPrevious}
            disabled={currentIndex === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-secondary hover:bg-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
            <span className="hidden sm:inline">Previous</span>
          </button>

          {/* Chapter slider */}
          <input
            type="range"
            min={0}
            max={totalChunks - 1}
            value={currentIndex}
            onChange={(e) => setCurrentIndex(parseInt(e.target.value))}
            className="flex-1 mx-4 accent-accent"
          />

          <button
            onClick={goToNext}
            disabled={currentIndex >= totalChunks - 1}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-secondary hover:bg-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </nav>
    </div>
  );
}
