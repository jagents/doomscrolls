import { Link, useLocation } from 'react-router-dom';
import { Home, Compass, Search, Bookmark, User, Sun, Moon, Users, LogOut, LogIn, List } from 'lucide-react';
import { useUserStore } from '../../store/userStore';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import { api } from '../../services/api';

export function LeftSidebar() {
  const location = useLocation();
  const { theme, setTheme } = useUserStore();
  const { user, isAuthenticated, logout } = useAuthStore();
  const { openAuthModal } = useUIStore();

  const isLoggedIn = isAuthenticated();

  const navItems = [
    { path: '/', label: 'Home', icon: Home },
    { path: '/explore', label: 'Explore', icon: Compass },
    { path: '/search', label: 'Search', icon: Search },
    ...(isLoggedIn ? [{ path: '/following', label: 'Following', icon: Users }] : []),
    { path: '/bookmarks', label: 'Bookmarks', icon: Bookmark },
    { path: '/lists', label: 'Lists', icon: List },
    ...(isLoggedIn ? [{ path: '/profile', label: 'Profile', icon: User }] : []),
  ];

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch {
      // Ignore errors, logout locally anyway
    }
    logout();
  };

  return (
    <div className="flex flex-col h-full p-4 w-full">
      {/* Logo */}
      <Link to="/" className="text-2xl font-bold mb-8 px-4">
        Doomscrolls
      </Link>

      {/* Navigation */}
      <nav className="flex-1">
        <ul className="space-y-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;

            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={`flex items-center gap-4 px-4 py-3 rounded-full text-xl transition-colors hover:bg-secondary ${
                    isActive ? 'font-bold' : ''
                  }`}
                >
                  <Icon className="w-6 h-6" />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Auth Section */}
      <div className="border-t border-border pt-4 space-y-2">
        {isLoggedIn ? (
          <>
            {/* User Info */}
            <div className="px-4 py-2 mb-2">
              <p className="text-sm text-secondary">Signed in as</p>
              <p className="font-medium text-primary truncate">
                {user?.displayName || user?.email}
              </p>
            </div>
            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="flex items-center gap-4 px-4 py-3 rounded-full w-full text-xl transition-colors hover:bg-secondary text-secondary"
            >
              <LogOut className="w-6 h-6" />
              <span>Sign out</span>
            </button>
          </>
        ) : (
          <>
            {/* Sign In Button */}
            <button
              onClick={() => openAuthModal('login')}
              className="flex items-center gap-4 px-4 py-3 rounded-full w-full text-xl transition-colors hover:bg-secondary"
            >
              <LogIn className="w-6 h-6" />
              <span>Sign in</span>
            </button>
            {/* Sign Up Button */}
            <button
              onClick={() => openAuthModal('signup')}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-full w-full text-lg font-semibold bg-accent hover:bg-accent-hover text-white transition-colors"
            >
              Create account
            </button>
          </>
        )}

        {/* Theme Toggle */}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="flex items-center gap-4 px-4 py-3 rounded-full w-full text-xl transition-colors hover:bg-secondary mt-2"
        >
          {theme === 'dark' ? (
            <>
              <Sun className="w-6 h-6" />
              <span>Light Mode</span>
            </>
          ) : (
            <>
              <Moon className="w-6 h-6" />
              <span>Dark Mode</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
