# Implementation Notes for Native Apps

**Generated:** January 13, 2026

This document describes the compliance features implemented in the backend and webapp. Native apps (iOS, Android, Chrome) should follow these same patterns.

---

## API Endpoints

### Legal Documents

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/legal/privacy` | GET | Returns Privacy Policy HTML |
| `/legal/terms` | GET | Returns Terms of Service HTML |

**Usage:** Open these URLs in the system browser or in-app WebView.

### Account Deletion

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/auth/me` | DELETE | Required | Deletes user account and all data |

**Request:**
```http
DELETE /api/auth/me
Authorization: Bearer <access_token>
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Account deleted successfully"
}
```

**Data Deleted:**
- User account record
- All likes
- All bookmarks
- All reading lists (and their contents)
- Reading progress
- Author follows
- Refresh tokens
- Taste vectors (if any)

---

## Web App Implementation

### 1. Legal Links in Footer

**Location:** `webapp/src/components/layout/RightSidebar.tsx`

```tsx
{/* Legal Footer */}
<div className="text-xs text-secondary px-4 pt-4 border-t border-primary/10">
  <p className="mb-2">Scroll with purpose.</p>
  <div className="flex gap-2 mb-1">
    <a
      href="/legal/privacy"
      target="_blank"
      rel="noopener noreferrer"
      className="hover:text-primary transition-colors"
    >
      Privacy
    </a>
    <span>·</span>
    <a
      href="/legal/terms"
      target="_blank"
      rel="noopener noreferrer"
      className="hover:text-primary transition-colors"
    >
      Terms
    </a>
  </div>
  <p>© 2026 Dragon Dance Publishing</p>
</div>
```

**Key Points:**
- Links open in new tab (`target="_blank"`)
- Include `rel="noopener noreferrer"` for security
- Small text (text-xs) to not distract from content

### 2. Delete Account Modal

**Location:** `webapp/src/components/shared/DeleteAccountModal.tsx`

```tsx
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
          <button onClick={onClose} disabled={isDeleting}>Cancel</button>
          <button onClick={onConfirm} disabled={isDeleting}>
            {isDeleting ? 'Deleting...' : 'Delete Account'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Key Points:**
- Clear warning about what will be deleted
- "Cannot be undone" warning
- Loading state while deleting
- Cancel button to abort

### 3. Delete Account in Profile Page

**Location:** `webapp/src/pages/ProfilePage.tsx`

```tsx
// State
const [showDeleteModal, setShowDeleteModal] = useState(false);
const [isDeleting, setIsDeleting] = useState(false);

// Handler
const handleDeleteAccount = async () => {
  setIsDeleting(true);
  try {
    await api.deleteAccount();
    logout();           // Clear auth state
    resetFeed();        // Clear feed cache
    navigate('/');      // Go to home
  } catch (error) {
    alert('Failed to delete account. Please try again.');
  } finally {
    setIsDeleting(false);
  }
};

// UI - "Danger Zone" section in Settings
{isLoggedIn && (
  <div className="mt-8 pt-6 border-t border-red-500/20">
    <h4 className="text-red-500 font-semibold">Danger Zone</h4>
    <p>Permanently delete your account and all associated data.</p>
    <button onClick={() => setShowDeleteModal(true)}>
      Delete Account
    </button>
  </div>
)}
```

**Key Points:**
- Only shown to logged-in users
- "Danger Zone" styling (red border/text)
- Clears all local state after deletion
- Redirects to home page

---

## Native App Patterns

### iOS (Swift/SwiftUI)

**Legal Links:**
```swift
// In Settings view
Link("Privacy Policy", destination: URL(string: "https://yourdomain.com/legal/privacy")!)
Link("Terms of Service", destination: URL(string: "https://yourdomain.com/legal/terms")!)

// Or use SFSafariViewController for in-app browser
```

**Account Deletion:**
```swift
func deleteAccount() async throws {
    let url = URL(string: "\(apiBase)/auth/me")!
    var request = URLRequest(url: url)
    request.httpMethod = "DELETE"
    request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")

    let (_, response) = try await URLSession.shared.data(for: request)

    // Clear keychain, UserDefaults, etc.
    KeychainHelper.delete(key: "accessToken")
    UserDefaults.standard.removeObject(forKey: "user")

    // Navigate to onboarding/home
}
```

### Android (Kotlin)

**Legal Links:**
```kotlin
// Open in Chrome Custom Tab
val customTabsIntent = CustomTabsIntent.Builder().build()
customTabsIntent.launchUrl(context, Uri.parse("https://yourdomain.com/legal/privacy"))
```

**Account Deletion:**
```kotlin
suspend fun deleteAccount(): Result<Unit> {
    return withContext(Dispatchers.IO) {
        val response = apiService.deleteAccount()
        if (response.isSuccessful) {
            // Clear SharedPreferences, Room DB, etc.
            preferences.clear()
            database.clearAllTables()
            Result.success(Unit)
        } else {
            Result.failure(Exception("Failed to delete account"))
        }
    }
}
```

**Note:** Android also requires a web URL for account deletion (Google Play policy). The `/legal/privacy` URL can serve this purpose, or create a dedicated `/account/delete` web page.

### Chrome Extension

**Legal Links in popup.html:**
```html
<footer>
  <a href="https://yourdomain.com/legal/privacy" target="_blank">Privacy</a>
  <a href="https://yourdomain.com/legal/terms" target="_blank">Terms</a>
</footer>
```

**Account Management:**
For Chrome extensions, account management typically links to the web app rather than being implemented in the extension itself.

---

## Server Implementation Reference

### Legal Routes (`server/routes/legal.ts`)

```typescript
import { Hono } from 'hono';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const legal = new Hono();
const __dirname = dirname(fileURLToPath(import.meta.url));

// Cache HTML content
let privacyPolicyHtml: string | null = null;
let termsOfServiceHtml: string | null = null;

legal.get('/privacy', (c) => {
  if (!privacyPolicyHtml) {
    privacyPolicyHtml = readFileSync(
      join(__dirname, '../../store-compliance/privacy-policy.html'),
      'utf-8'
    );
  }
  return c.html(privacyPolicyHtml);
});

legal.get('/terms', (c) => {
  if (!termsOfServiceHtml) {
    termsOfServiceHtml = readFileSync(
      join(__dirname, '../../store-compliance/terms-of-service.html'),
      'utf-8'
    );
  }
  return c.html(termsOfServiceHtml);
});

export { legal };
```

### Delete User (`server/services/auth.ts`)

```typescript
export async function deleteUser(userId: string): Promise<void> {
  // Delete in order to handle foreign keys
  await sql`DELETE FROM user_taste_vectors WHERE user_id = ${userId}`;
  await sql`DELETE FROM user_stats WHERE user_id = ${userId}`;
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

---

## Testing Checklist

- [ ] `/legal/privacy` returns Privacy Policy HTML
- [ ] `/legal/terms` returns Terms of Service HTML
- [ ] Legal links visible in app footer/settings
- [ ] Legal links open in new tab/browser
- [ ] Delete Account button visible for logged-in users
- [ ] Delete Account shows confirmation modal
- [ ] Delete Account actually deletes all user data
- [ ] User is logged out after account deletion
- [ ] User is redirected to home after deletion

---

*End of Implementation Notes*
