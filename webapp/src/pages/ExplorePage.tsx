import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import type { Category } from '../types';

export function ExplorePage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getCategories()
      .then((res) => setCategories(res.categories))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-primary/80 backdrop-blur border-b border-border px-4 py-4">
        <h1 className="text-xl font-bold">Explore</h1>
      </div>

      {/* Categories Grid */}
      <div className="p-4">
        {loading ? (
          <div className="grid grid-cols-2 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-32 skeleton rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {categories.map((cat) => (
              <Link
                key={cat.id}
                to={`/?category=${cat.slug}`}
                className="bg-secondary hover:bg-tertiary rounded-2xl p-4 transition-colors group"
              >
                <div className="text-3xl mb-2">{cat.icon}</div>
                <h3 className="font-bold text-lg group-hover:text-accent transition-colors">
                  {cat.name}
                </h3>
                <p className="text-sm text-secondary">{cat.description}</p>
                {cat.work_count !== undefined && cat.work_count > 0 && (
                  <p className="text-xs text-secondary mt-2">
                    {cat.work_count} works
                  </p>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
