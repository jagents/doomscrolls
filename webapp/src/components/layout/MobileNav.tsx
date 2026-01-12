import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Home, Search, Bookmark, User, Sun, Moon } from 'lucide-react';
import { useUserStore } from '../../store/userStore';

const navItems = [
  { path: '/', label: 'Home', icon: Home },
  { path: '/explore', label: 'Explore', icon: Search },
  { path: '/bookmarks', label: 'Bookmarks', icon: Bookmark },
  { path: '/profile', label: 'Profile', icon: User },
];

export function MobileNav() {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const { theme, setTheme } = useUserStore();

  return (
    <>
      {/* Mobile Header */}
      <header className="lg:hidden sticky top-0 z-50 bg-primary border-b border-border">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => setIsOpen(true)}
            className="p-2 hover:bg-secondary rounded-full"
          >
            <Menu className="w-6 h-6" />
          </button>

          <Link to="/" className="text-xl font-bold">
            Doomscrolls
          </Link>

          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2 hover:bg-secondary rounded-full"
          >
            {theme === 'dark' ? <Sun className="w-6 h-6" /> : <Moon className="w-6 h-6" />}
          </button>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setIsOpen(false)}
          />

          {/* Drawer */}
          <div className="absolute left-0 top-0 bottom-0 w-[280px] bg-primary border-r border-border">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <span className="text-xl font-bold">Doomscrolls</span>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-secondary rounded-full"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <nav className="p-4">
              <ul className="space-y-2">
                {navItems.map((item) => {
                  const isActive = location.pathname === item.path;
                  const Icon = item.icon;

                  return (
                    <li key={item.path}>
                      <Link
                        to={item.path}
                        onClick={() => setIsOpen(false)}
                        className={`flex items-center gap-4 px-4 py-3 rounded-full text-lg transition-colors hover:bg-secondary ${
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
          </div>
        </div>
      )}

      {/* Bottom Navigation for Mobile */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-primary border-t border-border z-40">
        <div className="flex justify-around py-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`p-3 rounded-full transition-colors hover:bg-secondary ${
                  isActive ? 'text-accent' : ''
                }`}
              >
                <Icon className="w-6 h-6" />
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
