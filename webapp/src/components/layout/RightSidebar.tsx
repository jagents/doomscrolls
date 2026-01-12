import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import type { Author, Category } from '../../types';

export function RightSidebar() {
  const [authors, setAuthors] = useState<Author[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [authorsRes, categoriesRes] = await Promise.all([
          api.discoverAuthors(5),
          api.getCategories(),
        ]);
        setAuthors(authorsRes.authors);
        setCategories(categoriesRes.categories.slice(0, 8));
      } catch (error) {
        console.error('Failed to load sidebar data:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="p-4 space-y-6">
        <div className="bg-secondary rounded-2xl p-4">
          <div className="h-6 w-32 skeleton rounded mb-4" />
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-8 skeleton rounded mb-2" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Discover Authors */}
      {authors.length > 0 && (
        <div className="bg-secondary rounded-2xl p-4">
          <h2 className="text-xl font-bold mb-4">Discover Authors</h2>
          <ul className="space-y-3">
            {authors.map((author) => (
              <li key={author.id}>
                <Link
                  to={`/author/${author.slug}`}
                  className="flex items-center gap-3 hover:bg-tertiary p-2 rounded-lg transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-tertiary flex items-center justify-center text-lg font-bold">
                    {author.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{author.name}</p>
                    <p className="text-sm text-secondary truncate">
                      {author.era || author.primary_genre || 'Author'}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Categories */}
      {categories.length > 0 && (
        <div className="bg-secondary rounded-2xl p-4">
          <h2 className="text-xl font-bold mb-4">Categories</h2>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <Link
                key={cat.id}
                to={`/?category=${cat.slug}`}
                className="px-3 py-1.5 bg-tertiary rounded-full text-sm hover:bg-primary hover:ring-1 hover:ring-accent transition-all"
              >
                {cat.icon} {cat.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="text-sm text-secondary px-4 space-y-2">
        <p>Scroll with purpose.</p>
        <p>&copy; 2026 Doomscrolls</p>
      </div>
    </div>
  );
}
