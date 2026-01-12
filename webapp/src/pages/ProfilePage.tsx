import { Heart, Bookmark, Calendar } from 'lucide-react';
import { useUserStore } from '../store/userStore';

export function ProfilePage() {
  const { likes, bookmarks, theme, setTheme } = useUserStore();

  const stats = [
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
          <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center text-3xl">
            📚
          </div>
          <div>
            <h2 className="text-xl font-bold">Reader</h2>
            <p className="text-secondary">Scroll with purpose</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                className="bg-secondary rounded-xl p-4 text-center"
              >
                <Icon className={`w-6 h-6 mx-auto mb-2 ${stat.color}`} />
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-sm text-secondary">{stat.label}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Settings */}
      <div className="p-4">
        <h3 className="font-bold mb-4">Settings</h3>

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

        {/* Coming Soon */}
        <div className="mt-8 p-4 bg-secondary rounded-xl text-center">
          <Calendar className="w-8 h-8 mx-auto mb-2 text-accent" />
          <h4 className="font-bold mb-1">Account Sync Coming Soon</h4>
          <p className="text-sm text-secondary">
            Create an account to sync your likes and bookmarks across devices.
          </p>
        </div>
      </div>
    </div>
  );
}
