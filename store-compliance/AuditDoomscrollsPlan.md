# Implementation Plan for Doomscrolls

**Generated:** January 13, 2026
**Updated:** January 13, 2026 (Phase 2 COMPLETE)

---

## Status: Web App Complete ✅

All compliance features have been implemented and tested in the backend and webapp.

---

## Decisions (Resolved)

| Question | Decision |
|----------|----------|
| Footer placement | Bottom of right sidebar, single line |
| Account deletion confirmation | Simple dialog ("Are you sure?") |
| App icon | Simple text-based icon (e.g., "DS" or scroll imagery) |
| Copyright text | "© 2026 DDP" (not full company name) |
| Native apps | Web app first, then iOS/Android/Chrome follow patterns |
| Data export | Skip for now |

---

## What Was Implemented (Web App)

### Backend API
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/legal/privacy` | GET | Serves Privacy Policy HTML |
| `/legal/terms` | GET | Serves Terms of Service HTML |
| `/api/auth/me` | DELETE | Deletes user account + all data |

### Web App UI
- **Footer:** Single line in right sidebar: "Scroll with purpose. Privacy · Terms © 2026 DDP"
- **Delete Account:** "Danger Zone" section in Profile page with confirmation modal
- **Modal:** Lists all data that will be deleted, "cannot be undone" warning

### Files Changed
```
server/routes/legal.ts              (new)
server/services/auth.ts             (added deleteUser)
server/routes/auth.ts               (added DELETE /me)
server/app.ts                       (registered /legal routes)
webapp/src/components/layout/RightSidebar.tsx
webapp/src/components/shared/DeleteAccountModal.tsx  (new)
webapp/src/services/api.ts          (added deleteAccount)
webapp/src/pages/ProfilePage.tsx
```

---

## Lessons Learned (Webapp Implementation)

### 1. Route Order Matters
Legal routes must be registered BEFORE static file serving, otherwise the SPA fallback catches them.

```typescript
// Correct order in app.ts:
app.route('/api', routes);      // API first
app.route('/legal', legal);     // Legal routes second
app.use('/*', serveStatic(...)); // Static files last
```

### 2. ES Module Path Resolution
When using ES modules, `__dirname` doesn't exist. Use:
```typescript
import { dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
```

### 3. Cache Legal Documents
Read legal HTML files once at startup, not on every request:
```typescript
let privacyHtml: string | null = null;
function getPrivacyPolicy() {
  if (!privacyHtml) privacyHtml = readFileSync(...);
  return privacyHtml;
}
```

### 4. Footer Design
Keep it minimal - single line works well:
```
Scroll with purpose. Privacy · Terms © 2026 DDP
```

### 5. Delete Account Flow
- Show loading state during deletion
- Clear ALL local state (auth, feed cache, etc.)
- Redirect to home immediately after

---

## iOS Implementation Guide

### Requirements
- Privacy Policy link (Settings or About screen)
- Terms of Service link
- In-app account deletion (REQUIRED since 2022)
- App icon 1024x1024

### Legal Links
```swift
// Option 1: Open in Safari
UIApplication.shared.open(URL(string: "https://yourdomain.com/legal/privacy")!)

// Option 2: SFSafariViewController (stays in app)
import SafariServices
let vc = SFSafariViewController(url: URL(string: "https://yourdomain.com/legal/privacy")!)
present(vc, animated: true)
```

### Account Deletion
```swift
// In SettingsView.swift
Button("Delete Account", role: .destructive) {
    showDeleteConfirmation = true
}
.confirmationDialog("Delete Account?", isPresented: $showDeleteConfirmation) {
    Button("Delete", role: .destructive) {
        Task { await deleteAccount() }
    }
    Button("Cancel", role: .cancel) {}
} message: {
    Text("This will permanently delete your account and all data.")
}

func deleteAccount() async {
    var request = URLRequest(url: URL(string: "\(apiBase)/auth/me")!)
    request.httpMethod = "DELETE"
    request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")

    do {
        let (_, response) = try await URLSession.shared.data(for: request)
        if (response as? HTTPURLResponse)?.statusCode == 200 {
            // Clear Keychain
            KeychainHelper.delete("accessToken")
            KeychainHelper.delete("refreshToken")
            // Clear UserDefaults
            UserDefaults.standard.removePersistentDomain(forName: Bundle.main.bundleIdentifier!)
            // Navigate to onboarding
            isLoggedIn = false
        }
    } catch {
        // Show error alert
    }
}
```

### App Store Submission Tips
- Privacy Policy URL is required in App Store Connect
- If you have accounts, you MUST have in-app deletion
- Screenshot the delete account flow for review notes
- Apple may ask for demo account credentials

---

## Android Implementation Guide

### Requirements
- Privacy Policy link
- Terms of Service link
- In-app account deletion
- Web URL for account deletion (Google Play requirement)
- App icon 512x512

### Legal Links
```kotlin
// Chrome Custom Tabs (recommended)
val customTabsIntent = CustomTabsIntent.Builder()
    .setShowTitle(true)
    .build()
customTabsIntent.launchUrl(context, Uri.parse("https://yourdomain.com/legal/privacy"))

// Or simple browser intent
val intent = Intent(Intent.ACTION_VIEW, Uri.parse("https://yourdomain.com/legal/privacy"))
startActivity(intent)
```

### Account Deletion
```kotlin
// In SettingsFragment.kt
binding.deleteAccountButton.setOnClickListener {
    MaterialAlertDialogBuilder(requireContext())
        .setTitle("Delete Account?")
        .setMessage("This will permanently delete your account and all data including likes, bookmarks, lists, and reading progress.\n\nThis cannot be undone.")
        .setPositiveButton("Delete") { _, _ ->
            viewModel.deleteAccount()
        }
        .setNegativeButton("Cancel", null)
        .show()
}

// In SettingsViewModel.kt
fun deleteAccount() {
    viewModelScope.launch {
        _isLoading.value = true
        try {
            val response = apiService.deleteAccount() // DELETE /api/auth/me
            if (response.isSuccessful) {
                // Clear SharedPreferences
                prefs.edit().clear().apply()
                // Clear Room database
                database.clearAllTables()
                // Navigate to login
                _navigateToLogin.value = true
            }
        } catch (e: Exception) {
            _error.value = "Failed to delete account"
        } finally {
            _isLoading.value = false
        }
    }
}
```

### Google Play Data Safety Form
Answer these questions:
- **Data collected:** Email (account), User activity (likes, bookmarks)
- **Data shared:** None
- **Data encrypted in transit:** Yes
- **Users can request deletion:** Yes
- **Deletion URL:** https://yourdomain.com/legal/privacy (or dedicated page)

### Play Store Submission Tips
- Must provide web URL for account deletion (not just in-app)
- Fill out Data Safety form completely
- Target API level requirements change yearly

---

## Chrome Extension Implementation Guide

### Requirements
- Privacy Policy link in popup or options
- Terms of Service link
- Clear permission justifications
- Manifest V3 compliant

### manifest.json
```json
{
  "manifest_version": 3,
  "name": "Doomscrolls",
  "version": "1.0.0",
  "description": "Classical literature in your browser",
  "permissions": ["storage"],
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon-16.png",
      "48": "icons/icon-48.png",
      "128": "icons/icon-128.png"
    }
  }
}
```

### popup.html Footer
```html
<footer class="footer">
  Scroll with purpose.
  <a href="https://yourdomain.com/legal/privacy" target="_blank">Privacy</a> ·
  <a href="https://yourdomain.com/legal/terms" target="_blank">Terms</a>
  © 2026 DDP
</footer>
```

### Account Management
For extensions, account management typically links to the web app:
```html
<a href="https://yourdomain.com/profile" target="_blank">Manage Account</a>
```

### Chrome Web Store Submission Tips
- Single purpose description is critical
- Justify EVERY permission in detail
- Screenshots must be 1280x800 or 640x400
- Privacy policy URL required

---

## API Reference for All Platforms

### Authentication Header
```
Authorization: Bearer <access_token>
```

### Delete Account
```http
DELETE /api/auth/me
Authorization: Bearer <access_token>

Response 200:
{
  "success": true,
  "message": "Account deleted successfully"
}
```

### Legal Documents
```http
GET /legal/privacy   → HTML page
GET /legal/terms     → HTML page
```

---

## Remaining Tasks

### Still Needed
- [ ] App icons (1024, 512, 192, 128, favicon)
- [ ] Screenshots for each platform
- [ ] iOS app implementation
- [ ] Android app implementation
- [ ] Chrome extension implementation

### Store Listings Needed
- [ ] iOS: App Store Connect listing
- [ ] Android: Play Store listing + Data Safety form
- [ ] Chrome: Web Store listing + permission justifications

---

## Quick Reference

| Platform | Legal Links | Delete Account | Icon Size |
|----------|-------------|----------------|-----------|
| Web | Footer (done) | Profile page (done) | favicon |
| iOS | Settings/About | Settings (in-app required) | 1024x1024 |
| Android | Settings/About | Settings + web URL | 512x512 |
| Chrome | Popup footer | Link to web app | 128x128 |

---

*Web implementation complete. Native apps can follow patterns above.*
