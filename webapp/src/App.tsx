import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { HomePage } from './pages/HomePage';
import { ExplorePage } from './pages/ExplorePage';
import { BookmarksPage } from './pages/BookmarksPage';
import { ProfilePage } from './pages/ProfilePage';
import { AuthorPage } from './pages/AuthorPage';
import { WorkPage } from './pages/WorkPage';
import { PassagePage } from './pages/PassagePage';
import { AdminPage } from './pages/AdminPage';
import { FollowingPage } from './pages/FollowingPage';
import { SearchPage } from './pages/SearchPage';
import { ReaderPage } from './pages/ReaderPage';
import { ListsPage } from './pages/ListsPage';
import { ListPage } from './pages/ListPage';
import { AuthModal } from './components/auth/AuthModal';
import { useUIStore } from './store/uiStore';

function App() {
  const { authModalOpen, authModalMode, closeAuthModal } = useUIStore();

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="explore" element={<ExplorePage />} />
          <Route path="following" element={<FollowingPage />} />
          <Route path="bookmarks" element={<BookmarksPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="lists" element={<ListsPage />} />
          <Route path="list/:id" element={<ListPage />} />
          <Route path="author/:slug" element={<AuthorPage />} />
          <Route path="work/:slug" element={<WorkPage />} />
          <Route path="work/:slug/read" element={<ReaderPage />} />
          <Route path="passage/:id" element={<PassagePage />} />
        </Route>
        <Route path="admin" element={<AdminPage />} />
      </Routes>

      <AuthModal
        isOpen={authModalOpen}
        onClose={closeAuthModal}
        initialMode={authModalMode}
      />
    </BrowserRouter>
  );
}

export default App;
