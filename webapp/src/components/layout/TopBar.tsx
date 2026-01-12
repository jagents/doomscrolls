import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import type { Category } from '../../types';

interface TopBarProps {
  title?: string;
  showBack?: boolean;
  currentCategory?: string | null;
  onCategoryChange?: (category: string | null) => void;
}

export function TopBar({ title, showBack, currentCategory, onCategoryChange }: TopBarProps) {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);

  const showCategories = onCategoryChange !== undefined;

  useEffect(() => {
    if (showCategories) {
      api.getCategories().then((res) => setCategories(res.categories));
    }
  }, [showCategories]);

  // Simple title bar mode
  if (title && !showCategories) {
    return (
      <div className="sticky top-0 z-10 bg-primary/80 backdrop-blur border-b border-border">
        <div className="flex items-center gap-4 px-4 py-3">
          {showBack && (
            <button
              onClick={() => navigate(-1)}
              className="p-2 -ml-2 rounded-full hover:bg-secondary transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <h1 className="text-xl font-bold">{title}</h1>
        </div>
      </div>
    );
  }

  // Category tabs mode
  return (
    <div className="sticky top-0 z-10 bg-primary/80 backdrop-blur border-b border-border">
      <div className="flex overflow-x-auto scrollbar-hide">
        <button
          onClick={() => onCategoryChange?.(null)}
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
            onClick={() => onCategoryChange?.(cat.slug)}
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
