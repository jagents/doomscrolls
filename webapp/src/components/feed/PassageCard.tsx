import { Link } from 'react-router-dom';
import { Heart, Bookmark, Share2 } from 'lucide-react';
import { useUserStore } from '../../store/userStore';
import { useFeedStore } from '../../store/feedStore';
import { api } from '../../services/api';
import type { Passage } from '../../types';

interface PassageCardProps {
  passage: Passage;
}

export function PassageCard({ passage }: PassageCardProps) {
  const { likes, bookmarks, toggleLike, toggleBookmark } = useUserStore();
  const { updatePassageLikeCount } = useFeedStore();

  const isLiked = likes.includes(passage.id);
  const isBookmarked = bookmarks.includes(passage.id);

  const handleLike = async () => {
    const willLike = !isLiked;
    toggleLike(passage.id);
    updatePassageLikeCount(passage.id, willLike ? 1 : -1);

    try {
      await api.likePassage(passage.id, willLike);
    } catch (error) {
      // Revert on error
      toggleLike(passage.id);
      updatePassageLikeCount(passage.id, willLike ? -1 : 1);
    }
  };

  const handleBookmark = () => {
    toggleBookmark(passage.id);
  };

  const handleShare = async () => {
    const shareData = {
      title: `${passage.author.name} - Doomscrolls`,
      text: `"${passage.text.slice(0, 100)}${passage.text.length > 100 ? '...' : ''}"`,
      url: `${window.location.origin}/passage/${passage.id}`,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        // User cancelled or error
      }
    } else {
      // Fallback: copy to clipboard
      await navigator.clipboard.writeText(`${shareData.text}\n\n— ${passage.author.name}\n${shareData.url}`);
    }
  };

  return (
    <article className="p-4 border-b border-border hover:bg-secondary/30 transition-colors">
      {/* Passage Text */}
      <blockquote className="text-lg leading-relaxed mb-3">
        {passage.text}
      </blockquote>

      {/* Attribution */}
      <div className="flex items-center gap-2 text-sm text-secondary mb-4">
        <span>—</span>
        <Link
          to={`/author/${passage.author.slug}`}
          className="hover:underline font-medium text-primary"
        >
          {passage.author.name}
        </Link>
        {passage.work && (
          <>
            <span>in</span>
            <Link
              to={`/work/${passage.work.slug}`}
              className="hover:underline italic"
            >
              {passage.work.title}
            </Link>
          </>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-8">
        {/* Like */}
        <button
          onClick={handleLike}
          className={`flex items-center gap-2 transition-colors group ${
            isLiked ? 'text-like' : 'text-secondary hover:text-like'
          }`}
        >
          <div className="p-2 rounded-full group-hover:bg-like/10 transition-colors">
            <Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
          </div>
          <span className="text-sm">{passage.like_count}</span>
        </button>

        {/* Bookmark */}
        <button
          onClick={handleBookmark}
          className={`transition-colors group ${
            isBookmarked ? 'text-accent' : 'text-secondary hover:text-accent'
          }`}
        >
          <div className="p-2 rounded-full group-hover:bg-accent/10 transition-colors">
            <Bookmark className={`w-5 h-5 ${isBookmarked ? 'fill-current' : ''}`} />
          </div>
        </button>

        {/* Share */}
        <button
          onClick={handleShare}
          className="text-secondary hover:text-accent transition-colors group"
        >
          <div className="p-2 rounded-full group-hover:bg-accent/10 transition-colors">
            <Share2 className="w-5 h-5" />
          </div>
        </button>
      </div>
    </article>
  );
}
