import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CustomFeed } from '../components/feed/CustomFeed';
import { TopBar } from '../components/layout/TopBar';
import { useAuthStore } from '../store/authStore';
import { useUIStore } from '../store/uiStore';
import { api } from '../services/api';

export function FollowingPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const { openAuthModal } = useUIStore();

  useEffect(() => {
    if (!isAuthenticated()) {
      openAuthModal('login');
      navigate('/');
    }
  }, [isAuthenticated, openAuthModal, navigate]);

  if (!isAuthenticated()) {
    return null;
  }

  return (
    <div>
      <TopBar title="Following" />
      <CustomFeed
        fetchFeed={async (cursor) => {
          return api.getFollowingFeed({ cursor, limit: 20 });
        }}
        emptyMessage="No passages from authors you follow yet"
        emptySubtext="Follow some authors to see their passages here!"
      />
    </div>
  );
}
