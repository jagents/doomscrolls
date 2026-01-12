import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Search as SearchIcon, Loader2 } from 'lucide-react';
import { TopBar } from '../components/layout/TopBar';
import { PassageCard } from '../components/feed/PassageCard';
import { api } from '../services/api';
import type { SearchResult } from '../types';

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';

  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchMethod, setSearchMethod] = useState<'hybrid' | 'keyword'>('keyword');
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    if (initialQuery) {
      performSearch(initialQuery);
    }
  }, []);

  const performSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const typeFilter = filter === 'all' ? undefined : filter;
      const result = await api.search(searchQuery, { type: typeFilter, limit: 30 });
      setResults(result.results);
      setSearchMethod(result.method);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchParams({ q: query });
    performSearch(query);
  };

  const filteredResults = results.filter((r) => {
    if (filter === 'all') return true;
    return r.type === filter;
  });

  return (
    <div>
      <TopBar title="Search" />

      {/* Search Input */}
      <div className="p-4 border-b border-border">
        <form onSubmit={handleSubmit} className="relative">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search passages, authors, works..."
            className="w-full pl-12 pr-4 py-3 bg-secondary rounded-full focus:outline-none focus:ring-2 focus:ring-accent text-primary placeholder:text-muted"
          />
        </form>

        {/* Filter Tabs */}
        <div className="flex gap-2 mt-4 overflow-x-auto">
          {['all', 'passage', 'author', 'work'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-full text-sm whitespace-nowrap transition-colors ${
                filter === f
                  ? 'bg-accent text-white'
                  : 'bg-secondary text-secondary hover:bg-hover'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}s
            </button>
          ))}
        </div>
      </div>

      {/* Search Method Indicator */}
      {results.length > 0 && (
        <div className="px-4 py-2 text-sm text-muted border-b border-border">
          {searchMethod === 'hybrid' ? 'Semantic + keyword search' : 'Keyword search'}
          {' - '}
          {filteredResults.length} results
        </div>
      )}

      {/* Results */}
      <div>
        {isLoading && (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-accent" />
          </div>
        )}

        {error && (
          <div className="p-8 text-center">
            <p className="text-red-500">{error}</p>
          </div>
        )}

        {!isLoading && !error && filteredResults.length === 0 && query && (
          <div className="text-center py-12">
            <p className="text-xl mb-2">No results found</p>
            <p className="text-secondary">Try different search terms</p>
          </div>
        )}

        {!isLoading && filteredResults.map((result, i) => (
          <div key={i}>
            {result.type === 'passage' && result.passage && (
              <PassageCard passage={result.passage} />
            )}

            {result.type === 'author' && result.author && (
              <Link
                to={`/author/${result.author.slug}`}
                className="block p-4 border-b border-border hover:bg-secondary transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold text-lg">
                    {result.author.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold text-primary">{result.author.name}</p>
                    <p className="text-sm text-secondary">
                      {result.author.era || 'Author'}
                      {result.author.work_count && ` - ${result.author.work_count} works`}
                    </p>
                  </div>
                </div>
              </Link>
            )}

            {result.type === 'work' && result.work && (
              <Link
                to={`/work/${result.work.slug}`}
                className="block p-4 border-b border-border hover:bg-secondary transition-colors"
              >
                <p className="font-semibold text-primary">{result.work.title}</p>
                <p className="text-sm text-secondary">
                  {result.work.author_name}
                  {result.work.year && ` (${result.work.year})`}
                </p>
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
