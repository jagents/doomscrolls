import { Outlet } from 'react-router-dom';
import { LeftSidebar } from './LeftSidebar';
import { RightSidebar } from './RightSidebar';
import { MobileNav } from './MobileNav';

export function Layout() {
  return (
    <div className="min-h-screen bg-primary text-primary">
      {/* Mobile Navigation */}
      <MobileNav />

      <div className="flex max-w-[1400px] mx-auto">
        {/* Left Sidebar - Hidden on mobile */}
        <aside className="hidden lg:flex lg:w-[275px] lg:flex-shrink-0 sticky top-0 h-screen">
          <LeftSidebar />
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0 max-w-[600px] border-x border-border min-h-screen">
          <Outlet />
        </main>

        {/* Right Sidebar - Hidden on mobile/tablet */}
        <aside className="hidden lg:block lg:w-[300px] lg:flex-shrink-0 sticky top-0 h-screen overflow-y-auto">
          <RightSidebar />
        </aside>
      </div>
    </div>
  );
}
