# Implementation Plan for Doomscrolls

**Generated:** January 13, 2026
**Updated:** January 13, 2026 (decisions finalized)

---

## Overview

This plan addresses the compliance gaps identified in the audit report. The primary gaps are:
1. Missing legal links (Privacy Policy, Terms of Service) in the app
2. Missing account deletion functionality (required by Apple and Google)
3. Missing legal API routes to serve policy documents
4. Missing app icons and store assets

**Strategy:** Implement everything in backend/API and webapp first. Document patterns learned so native apps (iOS, Android, Chrome) can follow the same approach.

---

## Decisions (Resolved)

| Question | Decision |
|----------|----------|
| Footer placement | Bottom of right sidebar |
| Account deletion confirmation | Simple dialog ("Are you sure?") |
| App icon | Simple text-based icon (e.g., "DS" or scroll imagery) |
| Native apps | Web app first, then iOS/Android/Chrome will follow patterns |
| Data export | Skip for now |

---

## Backend/API Changes

### 1. Add Legal Routes

**File:** `server/routes/legal.ts` (new file)

```typescript
import { Hono } from 'hono';
import { readFileSync } from 'fs';
import { join } from 'path';

const legal = new Hono();

// Serve Privacy Policy
legal.get('/privacy', (c) => {
  const html = readFileSync(
    join(__dirname, '../../store-compliance/privacy-policy.html'),
    'utf-8'
  );
  return c.html(html);
});

// Serve Terms of Service
legal.get('/terms', (c) => {
  const html = readFileSync(
    join(__dirname, '../../store-compliance/terms-of-service.html'),
    'utf-8'
  );
  return c.html(html);
});

export { legal };
```

**Routes:**
- `GET /legal/privacy` → serves privacy-policy.html
- `GET /legal/terms` → serves terms-of-service.html

**Why:** App stores require legal documents to be accessible via URL.

### 2. Add Account Deletion Endpoint

**File:** `server/routes/auth.ts` (modify)

```typescript
// DELETE /api/auth/me - Delete user account and all data
auth.delete('/me', requireAuth, async (c) => {
  const user = getCurrentUser(c);
  if (!user) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  await deleteUser(user.userId);
  deleteCookie(c, 'refresh_token', { path: '/' });

  return c.json({ success: true, message: 'Account deleted' });
});
```

**File:** `server/services/auth.ts` (add function)

```typescript
export async function deleteUser(userId: string): Promise<void> {
  // Delete in order to respect foreign key constraints
  // Most tables have ON DELETE CASCADE, but be explicit
  await sql`DELETE FROM user_taste_vectors WHERE user_id = ${userId}`;
  await sql`DELETE FROM reading_progress WHERE user_id = ${userId}`;
  await sql`DELETE FROM list_chunks WHERE list_id IN (SELECT id FROM lists WHERE user_id = ${userId})`;
  await sql`DELETE FROM lists WHERE user_id = ${userId}`;
  await sql`DELETE FROM user_follows WHERE user_id = ${userId}`;
  await sql`DELETE FROM user_bookmarks WHERE user_id = ${userId}`;
  await sql`DELETE FROM user_likes WHERE user_id = ${userId}`;
  await sql`DELETE FROM refresh_tokens WHERE user_id = ${userId}`;
  await sql`DELETE FROM users WHERE id = ${userId}`;
}
```

**Data deleted:**
- `users` table row
- `user_likes` entries
- `user_bookmarks` entries
- `user_follows` entries
- `lists` owned by user (and `list_chunks`)
- `reading_progress` entries
- `refresh_tokens` entries
- `user_taste_vectors` entries (if exists)

**Why:** Apple App Store requires in-app account deletion since 2022. Google Play requires it as well.

### 3. Register Routes

**File:** `server/app.ts` (modify)

```typescript
import { legal } from './routes/legal';

// Add with other route registrations
app.route('/legal', legal);
```

---

## Web App Changes

### 1. Add Legal Links to Right Sidebar

**File:** `webapp/src/components/layout/RightSidebar.tsx` (modify)

Add to the bottom of the right sidebar:

```tsx
{/* Legal Footer */}
<div className="mt-auto pt-4 border-t border-primary/10 text-xs text-secondary">
  <div className="flex gap-2">
    <a href="/legal/privacy" target="_blank" className="hover:text-primary">
      Privacy
    </a>
    <span>·</span>
    <a href="/legal/terms" target="_blank" className="hover:text-primary">
      Terms
    </a>
  </div>
  <p className="mt-1">© 2026 Dragon Dance Publishing</p>
</div>
```

**Why:** Legal links in footer, opening in new tab for clean UX.

### 2. Add Delete Account to Profile Page

**File:** `webapp/src/pages/ProfilePage.tsx` (modify)

Add a "Delete Account" section:

```tsx
{/* Danger Zone */}
<div className="mt-8 p-4 border border-red-500/30 rounded-lg">
  <h3 className="text-red-500 font-semibold mb-2">Danger Zone</h3>
  <p className="text-secondary text-sm mb-4">
    Permanently delete your account and all associated data.
  </p>
  <button
    onClick={() => setShowDeleteModal(true)}
    className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
  >
    Delete Account
  </button>
</div>

{/* Delete Confirmation Modal */}
{showDeleteModal && (
  <DeleteAccountModal
    onClose={() => setShowDeleteModal(false)}
    onConfirm={handleDeleteAccount}
  />
)}
```

### 3. Create Delete Account Modal

**File:** `webapp/src/components/modals/DeleteAccountModal.tsx` (new file)

```tsx
interface DeleteAccountModalProps {
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteAccountModal({ onClose, onConfirm }: DeleteAccountModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface p-6 rounded-lg max-w-md mx-4">
        <h2 className="text-xl font-bold text-red-500 mb-4">Delete Account?</h2>
        <p className="text-secondary mb-6">
          This will permanently delete your account and all your data including:
        </p>
        <ul className="list-disc list-inside text-secondary mb-6 space-y-1">
          <li>All liked passages</li>
          <li>All bookmarks</li>
          <li>All reading lists</li>
          <li>Reading progress</li>
          <li>Author follows</li>
        </ul>
        <p className="text-red-400 font-semibold mb-6">
          This action cannot be undone.
        </p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-primary/20 rounded hover:bg-primary/10"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Delete Account
          </button>
        </div>
      </div>
    </div>
  );
}
```

### 4. Add API Function

**File:** `webapp/src/services/api.ts` (modify)

```typescript
export async function deleteAccount(): Promise<void> {
  await fetchWithAuth('/api/auth/me', { method: 'DELETE' });
}
```

### 5. Handle Deletion in Profile Page

```typescript
const handleDeleteAccount = async () => {
  try {
    await api.deleteAccount();
    // Clear local state
    useAuthStore.getState().logout();
    useFeedStore.getState().reset();
    // Redirect to home
    navigate('/');
  } catch (error) {
    console.error('Failed to delete account:', error);
    alert('Failed to delete account. Please try again.');
  }
};
```

---

## App Icon (Simple Text-Based)

Create a simple icon with "DS" initials or scroll imagery.

**Files to create:**
- `webapp/public/icon-1024.png` - 1024x1024 (iOS App Store)
- `webapp/public/icon-512.png` - 512x512 (Android Play Store)
- `webapp/public/icon-192.png` - 192x192 (PWA)
- `webapp/public/icon-128.png` - 128x128 (Chrome Web Store)
- `webapp/public/favicon.ico` - Multi-size favicon

**Design concept:**
- Dark background (#1a1a1a or similar)
- "DS" in elegant serif font (like the literary content)
- Or: Simple scroll/book icon
- Keep it minimal and readable at small sizes

---

## Implementation Order

### Step 1: Backend (Do First)
1. Create `server/routes/legal.ts` with GET /legal/privacy and GET /legal/terms
2. Add `deleteUser()` function to `server/services/auth.ts`
3. Add `DELETE /api/auth/me` to `server/routes/auth.ts`
4. Register legal routes in `server/app.ts`
5. Test: `curl http://localhost:4800/legal/privacy` should return HTML

### Step 2: Web App (Do Second)
1. Add legal links to bottom of `RightSidebar.tsx`
2. Create `DeleteAccountModal.tsx` component
3. Add `deleteAccount()` to `api.ts`
4. Add delete account section to `ProfilePage.tsx`
5. Test: Login, go to profile, delete account should work

### Step 3: Icons (Can be parallel)
1. Create simple icon design
2. Export to required sizes
3. Add to `webapp/public/`
4. Update `index.html` with favicon link

---

## Estimated Effort

| Area | Effort | Time |
|------|--------|------|
| Backend/API | Low | ~30 min |
| Web App | Low | ~1 hour |
| Icons | Low | ~30 min |
| **Total** | **Low** | **~2 hours** |

---

## Files to Create/Modify

### New Files
- `server/routes/legal.ts` - Legal document routes
- `webapp/src/components/modals/DeleteAccountModal.tsx` - Confirmation modal
- `webapp/public/icon-*.png` - App icons
- `webapp/public/favicon.ico` - Favicon

### Modified Files
- `server/routes/auth.ts` - Add DELETE /api/auth/me
- `server/services/auth.ts` - Add deleteUser() function
- `server/app.ts` - Register legal routes
- `webapp/src/components/layout/RightSidebar.tsx` - Add legal links
- `webapp/src/pages/ProfilePage.tsx` - Add delete account section
- `webapp/src/services/api.ts` - Add deleteAccount() function
- `webapp/index.html` - Add favicon link

---

## Patterns for Native Apps

After webapp implementation, native apps should follow these patterns:

### API Endpoints (Same for All Platforms)
- `GET /legal/privacy` - Privacy Policy HTML
- `GET /legal/terms` - Terms of Service HTML
- `DELETE /api/auth/me` - Delete user account (requires auth token)

### Legal Links Pattern
- Open legal URLs in system browser or in-app WebView
- Place in Settings/About section of the app
- Links should open in new tab/window

### Account Deletion Pattern
1. User taps "Delete Account" in Settings
2. Show confirmation dialog with list of data to be deleted
3. On confirm, call `DELETE /api/auth/me` with auth token
4. Clear local auth state
5. Return to login/home screen

### iOS Specific
- Use `SFSafariViewController` for legal pages
- Deletion must be in-app (not just web link)

### Android Specific
- Use Chrome Custom Tabs for legal pages
- Must also provide web URL for account deletion (https://yourdomain.com/delete-account)

### Chrome Extension Specific
- Legal links in extension popup or options page
- Account management can link to web app

---

*Plan finalized. Ready for Phase 2 implementation.*
