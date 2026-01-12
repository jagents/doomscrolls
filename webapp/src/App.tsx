import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { HomePage } from './pages/HomePage';
import { ExplorePage } from './pages/ExplorePage';
import { BookmarksPage } from './pages/BookmarksPage';
import { ProfilePage } from './pages/ProfilePage';
import { AuthorPage } from './pages/AuthorPage';
import { WorkPage } from './pages/WorkPage';
import { PassagePage } from './pages/PassagePage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="explore" element={<ExplorePage />} />
          <Route path="bookmarks" element={<BookmarksPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="author/:slug" element={<AuthorPage />} />
          <Route path="work/:slug" element={<WorkPage />} />
          <Route path="passage/:id" element={<PassagePage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
