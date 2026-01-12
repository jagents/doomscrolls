import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Feed } from '../components/feed/Feed';
import { TopBar } from '../components/layout/TopBar';

export function HomePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryFromUrl = searchParams.get('category');
  const [category, setCategory] = useState<string | null>(categoryFromUrl);

  const handleCategoryChange = (newCategory: string | null) => {
    setCategory(newCategory);
    if (newCategory) {
      setSearchParams({ category: newCategory });
    } else {
      setSearchParams({});
    }
  };

  return (
    <div>
      <TopBar
        currentCategory={category}
        onCategoryChange={handleCategoryChange}
      />
      <Feed category={category} />
    </div>
  );
}
