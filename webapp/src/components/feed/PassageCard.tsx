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

  // Get author initials for avatar
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  };

  return (
    <article className="px-4 py-3 border-b border-border hover:bg-secondary/30 transition-colors">
      <div className="flex gap-3">
        {/* Avatar */}
        <Link to={`/author/${passage.author.slug}`} className="flex-shrink-0">
          <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold text-sm">
            {getInitials(passage.author.name)}
          </div>
        </Link>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header: Author & Work */}
          <div className="flex items-center gap-1 mb-1">
            <Link
              to={`/author/${passage.author.slug}`}
              className="font-bold hover:underline truncate"
            >
              {passage.author.name}
            </Link>
            {passage.work && (
              <>
                <span className="text-secondary">·</span>
                <Link
                  to={`/work/${passage.work.slug}`}
                  className="text-secondary hover:underline truncate"
                >
                  {passage.work.title}
                </Link>
              </>
            )}
          </div>

          {/* Passage Text */}
          <div className="text-[15px] leading-normal mb-3 whitespace-pre-wrap">
            {passage.text}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between max-w-md -ml-2">
            {/* Like */}
            <button
              onClick={handleLike}
              className={`flex items-center gap-1 transition-colors group ${
                isLiked ? 'text-like' : 'text-secondary hover:text-like'
              }`}
            >
              <div className="p-2 rounded-full group-hover:bg-like/10 transition-colors">
                <Heart className={`w-[18px] h-[18px] ${isLiked ? 'fill-current' : ''}`} />
              </div>
              <span className="text-sm">{passage.like_count > 0 ? passage.like_count : ''}</span>
            </button>

            {/* Bookmark */}
            <button
              onClick={handleBookmark}
              className={`flex items-center transition-colors group ${
                isBookmarked ? 'text-accent' : 'text-secondary hover:text-accent'
              }`}
            >
              <div className="p-2 rounded-full group-hover:bg-accent/10 transition-colors">
                <Bookmark className={`w-[18px] h-[18px] ${isBookmarked ? 'fill-current' : ''}`} />
              </div>
            </button>

            {/* Share */}
            <button
              onClick={handleShare}
              className="flex items-center text-secondary hover:text-accent transition-colors group"
            >
              <div className="p-2 rounded-full group-hover:bg-accent/10 transition-colors">
                <Share2 className="w-[18px] h-[18px]" />
              </div>
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
