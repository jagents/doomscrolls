interface DeleteAccountModalProps {
  onClose: () => void;
  onConfirm: () => void;
  isDeleting?: boolean;
}

export function DeleteAccountModal({ onClose, onConfirm, isDeleting }: DeleteAccountModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-xl max-w-md w-full p-6 shadow-xl">
        <h2 className="text-xl font-bold text-red-500 mb-4">Delete Account?</h2>

        <p className="text-secondary mb-4">
          This will permanently delete your account and all your data including:
        </p>

        <ul className="list-disc list-inside text-secondary mb-6 space-y-1 text-sm">
          <li>All liked passages</li>
          <li>All bookmarks</li>
          <li>All reading lists</li>
          <li>Reading progress</li>
          <li>Author follows</li>
        </ul>

        <p className="text-red-400 font-semibold mb-6 text-sm">
          This action cannot be undone.
        </p>

        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 border border-primary/20 rounded-lg hover:bg-primary/10 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
          >
            {isDeleting ? 'Deleting...' : 'Delete Account'}
          </button>
        </div>
      </div>
    </div>
  );
}
