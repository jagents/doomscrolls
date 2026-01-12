import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, MoreHorizontal, Trash2, Edit2, Lock, Globe } from 'lucide-react';
import { TopBar } from '../components/layout/TopBar';
import { PassageCard } from '../components/feed/PassageCard';
import { api } from '../services/api';
import { useAuthStore } from '../store/authStore';
import type { List, Passage } from '../types';

export function ListPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [list, setList] = useState<(List & { user?: { id: string; displayName: string } }) | null>(null);
  const [passages, setPassages] = useState<Passage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const isOwner = user && list?.user?.id === user.id;

  useEffect(() => {
    if (!id) return;

    const loadList = async () => {
      try {
        const result = await api.getList(id);
        setList(result.list);
        setPassages(result.passages);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load list');
      } finally {
        setIsLoading(false);
      }
    };

    loadList();
  }, [id]);

  const handleDelete = async () => {
    if (!id || !confirm('Are you sure you want to delete this list?')) return;

    try {
      await api.deleteList(id);
      navigate('/lists');
    } catch (err) {
      console.error('Failed to delete list:', err);
    }
  };

  const handleUpdate = async (name: string, description: string, isPublic: boolean) => {
    if (!id) return;

    try {
      const result = await api.updateList(id, { name, description, isPublic });
      setList({ ...list!, ...result.list });
      setShowEditModal(false);
    } catch (err) {
      console.error('Failed to update list:', err);
    }
  };

  const handleRemovePassage = async (chunkId: string) => {
    if (!id) return;

    try {
      await api.removeFromList(id, chunkId);
      setPassages(passages.filter((p) => p.id !== chunkId));
      setList((prev) => prev ? { ...prev, passageCount: prev.passageCount - 1 } : null);
    } catch (err) {
      console.error('Failed to remove passage:', err);
    }
  };

  if (isLoading) {
    return (
      <div>
        <TopBar title="List" showBack />
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
        </div>
      </div>
    );
  }

  if (error || !list) {
    return (
      <div>
        <TopBar title="List" showBack />
        <div className="p-8 text-center">
          <p className="text-red-500">{error || 'List not found'}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <TopBar title={list.name} showBack />

      {/* List Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl font-bold">{list.name}</h1>
              {list.isPublic ? (
                <Globe className="w-4 h-4 text-muted" />
              ) : (
                <Lock className="w-4 h-4 text-muted" />
              )}
            </div>
            {list.description && (
              <p className="text-secondary mb-2">{list.description}</p>
            )}
            <p className="text-sm text-muted">
              {list.passageCount} {list.passageCount === 1 ? 'passage' : 'passages'}
              {list.user && !list.isCurated && (
                <> by {list.user.displayName || 'Anonymous'}</>
              )}
              {list.isCurated && ' - Curated collection'}
            </p>
          </div>

          {isOwner && (
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-2 rounded-full hover:bg-secondary transition-colors"
              >
                <MoreHorizontal className="w-5 h-5" />
              </button>

              {showMenu && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowMenu(false)}
                  />
                  <div className="absolute right-0 top-full mt-1 bg-primary border border-border rounded-lg shadow-lg z-20 min-w-[160px]">
                    <button
                      onClick={() => { setShowEditModal(true); setShowMenu(false); }}
                      className="w-full px-4 py-3 flex items-center gap-3 hover:bg-secondary transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                      Edit list
                    </button>
                    <button
                      onClick={() => { handleDelete(); setShowMenu(false); }}
                      className="w-full px-4 py-3 flex items-center gap-3 hover:bg-secondary transition-colors text-red-500"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete list
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Passages */}
      <div>
        {passages.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-xl mb-2">This list is empty</p>
            <p className="text-secondary">Add passages to this list to see them here</p>
          </div>
        ) : (
          passages.map((passage) => (
            <div key={passage.id} className="relative">
              <PassageCard passage={passage} />
              {isOwner && (
                <button
                  onClick={() => handleRemovePassage(passage.id)}
                  className="absolute top-4 right-4 p-2 rounded-full bg-primary/80 hover:bg-secondary transition-colors"
                  title="Remove from list"
                >
                  <Trash2 className="w-4 h-4 text-red-500" />
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <EditListModal
          list={list}
          onClose={() => setShowEditModal(false)}
          onSave={handleUpdate}
        />
      )}
    </div>
  );
}

function EditListModal({
  list,
  onClose,
  onSave,
}: {
  list: List;
  onClose: () => void;
  onSave: (name: string, description: string, isPublic: boolean) => void;
}) {
  const [name, setName] = useState(list.name);
  const [description, setDescription] = useState(list.description || '');
  const [isPublic, setIsPublic] = useState(list.isPublic);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    await onSave(name, description, isPublic);
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-primary border border-border rounded-2xl w-full max-w-md mx-4 p-6">
        <h2 className="text-xl font-bold mb-4">Edit list</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-secondary mb-2">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-4 py-3 bg-secondary border border-border rounded-lg focus:outline-none focus:border-accent"
            />
          </div>

          <div>
            <label className="block text-sm text-secondary mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
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
              {isSubmitting ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
