import { Link, useLocation } from 'react-router-dom';
import { Home, Search, Bookmark, User, Sun, Moon } from 'lucide-react';
import { useUserStore } from '../../store/userStore';

const navItems = [
  { path: '/', label: 'Home', icon: Home },
  { path: '/explore', label: 'Explore', icon: Search },
  { path: '/bookmarks', label: 'Bookmarks', icon: Bookmark },
  { path: '/profile', label: 'Profile', icon: User },
];

export function LeftSidebar() {
  const location = useLocation();
  const { theme, setTheme } = useUserStore();

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

      {/* Theme Toggle */}
      <div className="border-t border-border pt-4">
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="flex items-center gap-4 px-4 py-3 rounded-full w-full text-xl transition-colors hover:bg-secondary"
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
