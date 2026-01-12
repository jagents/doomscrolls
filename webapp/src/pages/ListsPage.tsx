import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Loader2, List as ListIcon, Lock, Globe } from 'lucide-react';
import { TopBar } from '../components/layout/TopBar';
import { api } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { useUIStore } from '../store/uiStore';
import type { List } from '../types';

export function ListsPage() {
  const { isAuthenticated } = useAuthStore();
  const { openAuthModal } = useUIStore();

  const [myLists, setMyLists] = useState<List[]>([]);
  const [curatedLists, setCuratedLists] = useState<List[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    const loadLists = async () => {
      setIsLoading(true);
      try {
        // Load curated lists for everyone
        const curated = await api.getCuratedLists();
        setCuratedLists(curated.lists);

        // Load user's lists if authenticated
        if (isAuthenticated()) {
          const mine = await api.getLists();
          setMyLists(mine.lists);
        }
      } catch (error) {
        console.error('Failed to load lists:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadLists();
  }, [isAuthenticated]);

  const handleCreateList = async (name: string, description: string, isPublic: boolean) => {
    try {
      const result = await api.createList(name, description, isPublic);
      setMyLists([result.list, ...myLists]);
      setShowCreateModal(false);
    } catch (error) {
      console.error('Failed to create list:', error);
    }
  };

  return (
    <div>
      <TopBar title="Lists" />

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
        </div>
      ) : (
        <div className="divide-y divide-border">
          {/* Create List Button */}
          {isAuthenticated() && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="w-full p-4 flex items-center gap-3 hover:bg-secondary transition-colors"
            >
              <div className="w-12 h-12 rounded-lg bg-accent/20 flex items-center justify-center">
                <Plus className="w-6 h-6 text-accent" />
              </div>
              <span className="font-medium">Create new list</span>
            </button>
          )}

          {/* My Lists */}
          {isAuthenticated() && myLists.length > 0 && (
            <div>
              <h2 className="px-4 py-3 text-sm font-semibold text-secondary uppercase tracking-wider bg-secondary/50">
                Your Lists
              </h2>
              {myLists.map((list) => (
                <ListCard key={list.id} list={list} />
              ))}
            </div>
          )}

          {/* Curated Lists */}
          {curatedLists.length > 0 && (
            <div>
              <h2 className="px-4 py-3 text-sm font-semibold text-secondary uppercase tracking-wider bg-secondary/50">
                Curated Collections
              </h2>
              {curatedLists.map((list) => (
                <ListCard key={list.id} list={list} />
              ))}
            </div>
          )}

          {/* Sign in prompt */}
          {!isAuthenticated() && (
            <div className="p-8 text-center">
              <ListIcon className="w-12 h-12 mx-auto mb-4 text-muted" />
              <p className="text-lg mb-2">Create your own lists</p>
              <p className="text-secondary mb-4">
                Sign in to save and organize your favorite passages
              </p>
              <button
                onClick={() => openAuthModal('login')}
                className="px-6 py-3 bg-accent hover:bg-accent-hover text-white font-semibold rounded-full transition-colors"
              >
                Sign in
              </button>
            </div>
          )}
        </div>
      )}

      {/* Create List Modal */}
      {showCreateModal && (
        <CreateListModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateList}
        />
      )}
    </div>
  );
}

function ListCard({ list }: { list: List }) {
  return (
    <Link
      to={`/list/${list.id}`}
      className="block p-4 hover:bg-secondary transition-colors"
    >
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-lg bg-accent/20 flex items-center justify-center flex-shrink-0">
          <ListIcon className="w-6 h-6 text-accent" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-primary truncate">{list.name}</p>
            {list.isPublic ? (
              <Globe className="w-4 h-4 text-muted flex-shrink-0" />
            ) : (
              <Lock className="w-4 h-4 text-muted flex-shrink-0" />
            )}
          </div>
          {list.description && (
            <p className="text-sm text-secondary line-clamp-2">{list.description}</p>
          )}
          <p className="text-sm text-muted mt-1">
            {list.passageCount} {list.passageCount === 1 ? 'passage' : 'passages'}
          </p>
        </div>
      </div>
    </Link>
  );
}

function CreateListModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (name: string, description: string, isPublic: boolean) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    await onCreate(name, description, isPublic);
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-primary border border-border rounded-2xl w-full max-w-md mx-4 p-6">
        <h2 className="text-xl font-bold mb-4">Create new list</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-secondary mb-2">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My favorite quotes"
              required
              className="w-full px-4 py-3 bg-secondary border border-border rounded-lg focus:outline-none focus:border-accent"
            />
          </div>

          <div>
            <label className="block text-sm text-secondary mb-2">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this list about?"
              rows={3}
              className="w-full px-4 py-3 bg-secondary border border-border rounded-lg focus:outline-none focus:border-accent resize-none"
            />
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="w-5 h-5 rounded accent-accent"
            />
            <span className="text-secondary">Make this list public</span>
          </label>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-secondary hover:bg-hover rounded-full transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="flex-1 py-3 bg-accent hover:bg-accent-hover text-white font-semibold rounded-full transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
