import { useEffect, useState } from 'react';
import { api } from '../../services/api';
import type { Category } from '../../types';

interface TopBarProps {
  currentCategory: string | null;
  onCategoryChange: (category: string | null) => void;
}

export function TopBar({ currentCategory, onCategoryChange }: TopBarProps) {
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    api.getCategories().then((res) => setCategories(res.categories));
  }, []);

  return (
    <div className="sticky top-0 z-10 bg-primary/80 backdrop-blur border-b border-border">
      <div className="flex overflow-x-auto scrollbar-hide">
        <button
          onClick={() => onCategoryChange(null)}
          className={`px-6 py-4 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
            currentCategory === null
              ? 'border-accent text-primary'
              : 'border-transparent text-secondary hover:bg-secondary'
          }`}
        >
          For You
        </button>

        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => onCategoryChange(cat.slug)}
            className={`px-6 py-4 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              currentCategory === cat.slug
                ? 'border-accent text-primary'
                : 'border-transparent text-secondary hover:bg-secondary'
            }`}
          >
            {cat.icon} {cat.name}
          </button>
        ))}
      </div>
    </div>
  );
}
