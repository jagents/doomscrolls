import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Heart, Bookmark, Users, BookOpen, List, LogOut, Settings, ChevronRight, Loader2, Trash2 } from 'lucide-react';
import { useUserStore } from '../store/userStore';
import { useAuthStore } from '../store/authStore';
import { useUIStore } from '../store/uiStore';
import { useFeedStore } from '../store/feedStore';
import { api } from '../services/api';
import { DeleteAccountModal } from '../components/shared/DeleteAccountModal';
import type { UserStats, ReadingProgress } from '../types';

export function ProfilePage() {
  const navigate = useNavigate();
  const { likes, bookmarks, theme, setTheme } = useUserStore();
  const { user, isAuthenticated, logout } = useAuthStore();
  const { openAuthModal } = useUIStore();
  const { reset: resetFeed } = useFeedStore();

  const [stats, setStats] = useState<UserStats | null>(null);
  const [reading, setReading] = useState<ReadingProgress[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isLoggedIn = isAuthenticated();

  useEffect(() => {
    if (isLoggedIn) {
      setIsLoading(true);
      Promise.all([
        api.getUserStats(),
        api.getUserReading(),
      ])
        .then(([statsRes, readingRes]) => {
          setStats(statsRes.stats);
          setReading(readingRes.reading);
        })
        .catch(console.error)
        .finally(() => setIsLoading(false));
    }
  }, [isLoggedIn]);

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch {
      // Ignore errors
    }
    logout();
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      await api.deleteAccount();
      // Clear all local state
      logout();
      resetFeed();
      setShowDeleteModal(false);
      // Redirect to home
      navigate('/');
    } catch (error) {
      console.error('Failed to delete account:', error);
      alert('Failed to delete account. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const statItems = isLoggedIn && stats
    ? [
        { label: 'Liked', value: stats.likeCount, icon: Heart, color: 'text-like' },
        { label: 'Bookmarked', value: stats.bookmarkCount, icon: Bookmark, color: 'text-accent' },
        { label: 'Following', value: stats.followingCount, icon: Users, color: 'text-green-500' },
        { label: 'Lists', value: stats.listsCount, icon: List, color: 'text-purple-500' },
      ]
    : [
        { label: 'Liked', value: likes.length, icon: Heart, color: 'text-like' },
        { label: 'Bookmarked', value: bookmarks.length, icon: Bookmark, color: 'text-accent' },
      ];

  return (
    <div>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-primary/80 backdrop-blur border-b border-border px-4 py-4">
        <h1 className="text-xl font-bold">Profile</h1>
      </div>

      {/* Profile Card */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-20 h-20 rounded-full bg-accent/20 flex items-center justify-center text-3xl text-accent font-bold">
            {isLoggedIn && user ? user.displayName?.charAt(0) || user.email.charAt(0).toUpperCase() : '?'}
          </div>
          <div className="flex-1">
            {isLoggedIn && user ? (
              <>
                <h2 className="text-xl font-bold">{user.displayName || 'Reader'}</h2>
                <p className="text-secondary">{user.email}</p>
              </>
            ) : (
              <>
                <h2 className="text-xl font-bold">Guest Reader</h2>
                <p className="text-secondary">Sign in to sync your data</p>
              </>
            )}
          </div>
        </div>

        {/* Stats */}
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-accent" />
          </div>
        ) : (
          <div className={`grid gap-4 ${statItems.length > 2 ? 'grid-cols-4' : 'grid-cols-2'}`}>
            {statItems.map((stat) => {
              const Icon = stat.icon;
              return (
                <div
                  key={stat.label}
                  className="bg-secondary rounded-xl p-4 text-center"
                >
                  <Icon className={`w-5 h-5 mx-auto mb-1 ${stat.color}`} />
                  <p className="text-xl font-bold">{stat.value}</p>
                  <p className="text-xs text-secondary">{stat.label}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Reading Progress */}
      {isLoggedIn && reading.length > 0 && (
        <div className="p-4 border-b border-border">
          <h3 className="font-bold mb-3">Continue Reading</h3>
          <div className="space-y-3">
            {reading.slice(0, 3).map((item) => (
              <Link
                key={item.workId}
                to={`/work/${item.workSlug}/read`}
                className="flex items-center gap-3 p-3 bg-secondary rounded-lg hover:bg-hover transition-colors"
              >
                <BookOpen className="w-5 h-5 text-accent flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{item.workTitle}</p>
                  <p className="text-sm text-secondary">{item.authorName}</p>
                  <div className="mt-1 h-1.5 bg-primary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent"
                      style={{ width: `${item.percentComplete}%` }}
                    />
                  </div>
                </div>
                <span className="text-sm text-muted">{item.percentComplete}%</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Quick Links */}
      {isLoggedIn && (
        <div className="p-4 border-b border-border">
          <h3 className="font-bold mb-3">Your Library</h3>
          <div className="space-y-1">
            <Link
              to="/bookmarks"
              className="flex items-center justify-between p-3 hover:bg-secondary rounded-lg transition-colors"
            >
              <div className="flex items-center gap-3">
                <Bookmark className="w-5 h-5 text-accent" />
                <span>Bookmarks</span>
              </div>
              <ChevronRight className="w-5 h-5 text-muted" />
            </Link>
            <Link
              to="/lists"
              className="flex items-center justify-between p-3 hover:bg-secondary rounded-lg transition-colors"
            >
              <div className="flex items-center gap-3">
                <List className="w-5 h-5 text-purple-500" />
                <span>Your Lists</span>
              </div>
              <ChevronRight className="w-5 h-5 text-muted" />
            </Link>
            <Link
              to="/following"
              className="flex items-center justify-between p-3 hover:bg-secondary rounded-lg transition-colors"
            >
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-green-500" />
                <span>Following</span>
              </div>
              <ChevronRight className="w-5 h-5 text-muted" />
            </Link>
          </div>
        </div>
      )}

      {/* Settings */}
      <div className="p-4">
        <h3 className="font-bold mb-3 flex items-center gap-2">
          <Settings className="w-5 h-5" />
          Settings
        </h3>

        {/* Theme */}
        <div className="flex items-center justify-between py-3 border-b border-border">
          <span>Theme</span>
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value as 'light' | 'dark')}
            className="bg-secondary rounded-lg px-3 py-2 text-sm"
          >
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </select>
        </div>

        {/* Auth Actions */}
        {isLoggedIn ? (
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full py-3 text-red-500 hover:bg-secondary rounded-lg transition-colors mt-2 px-1"
          >
            <LogOut className="w-5 h-5" />
            Sign out
          </button>
        ) : (
          <div className="mt-6 space-y-3">
            <button
              onClick={() => openAuthModal('signup')}
              className="w-full py-3 bg-accent hover:bg-accent-hover text-white font-semibold rounded-full transition-colors"
            >
              Create account
            </button>
            <button
              onClick={() => openAuthModal('login')}
              className="w-full py-3 bg-secondary hover:bg-hover font-semibold rounded-full transition-colors"
            >
              Sign in
            </button>
            <p className="text-center text-sm text-secondary">
              Sign in to sync your likes and bookmarks across devices
            </p>
          </div>
        )}

        {/* Danger Zone - Only for logged in users */}
        {isLoggedIn && (
          <div className="mt-8 pt-6 border-t border-red-500/20">
            <h4 className="text-red-500 font-semibold mb-3 flex items-center gap-2">
              <Trash2 className="w-4 h-4" />
              Danger Zone
            </h4>
            <p className="text-secondary text-sm mb-4">
              Permanently delete your account and all associated data.
            </p>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="px-4 py-2 bg-red-500/10 text-red-500 border border-red-500/30 rounded-lg hover:bg-red-500/20 transition-colors"
            >
              Delete Account
            </button>
          </div>
        )}
      </div>

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <DeleteAccountModal
          onClose={() => setShowDeleteModal(false)}
          onConfirm={handleDeleteAccount}
          isDeleting={isDeleting}
        />
      )}
    </div>
  );
}
