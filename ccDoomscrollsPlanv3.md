# Doomscrolls Native Apps Implementation Plan

**Created:** January 13, 2026
**Version:** 3.0
**Status:** Ready for Native Development
**Prerequisite:** Web App Complete (Phase 2)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Web App Feature Reference](#2-web-app-feature-reference)
3. [API Reference](#3-api-reference)
4. [Compliance Requirements](#4-compliance-requirements)
5. [iOS Implementation](#5-ios-implementation)
6. [Android Implementation](#6-android-implementation)
7. [Chrome Extension Implementation](#7-chrome-extension-implementation)
8. [App Store Submission Checklists](#8-app-store-submission-checklists)
9. [Assets Required](#9-assets-required)
10. [Testing Checklist](#10-testing-checklist)

---

## 1. Executive Summary

### Goal

Build native iOS, Android, and Chrome extension apps that replicate the Doomscrolls web app experience. All apps connect to the existing backend API.

### What is Doomscrolls?

An infinite scroll app that transforms "doomscrolling" into something meaningful: passages from classical literature, philosophy, poetry, and wisdom texts. Instead of tweets and status updates, users scroll through humanity's greatest writings.

### Core Value

> "If you're going to scroll, scroll through wisdom."

### Backend Status

The backend is **complete** and running. Native apps only need to:
- Consume the existing REST API
- Implement UI that matches the web app
- Meet app store compliance requirements

### API Base URL

```
Production: https://your-domain.com/api
Development: http://localhost:4800/api
```

---

## 2. Web App Feature Reference

### 2.1 Core Features to Replicate

| Feature | Priority | Description |
|---------|----------|-------------|
| Infinite Feed | P0 | Endless scroll of passage cards |
| Passage Cards | P0 | Author, work title, text, like/bookmark buttons |
| Like/Bookmark | P0 | Save interactions (local + server sync) |
| User Auth | P0 | Signup, login, logout |
| Category Filter | P1 | Filter feed by category tabs |
| Author Pages | P1 | Author profile with works list |
| Work Pages | P1 | Work details with passage list |
| Search | P1 | Find passages, authors, works |
| Following | P1 | Follow authors, dedicated feed |
| Lists | P2 | Create and manage passage collections |
| Work Reader | P2 | Sequential reading with progress |
| Profile | P2 | User stats and settings |
| Theme Toggle | P2 | Dark/Light mode |

### 2.2 Feed Layout

```
┌─────────────────────────────────────────┐
│  [Category Tabs: For You | Following]   │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ [MA] Marcus Aurelius            │   │
│  │      Meditations                │   │
│  │ ─────────────────────────────── │   │
│  │ The happiness of your life     │   │
│  │ depends upon the quality of    │   │
│  │ your thoughts...               │   │
│  │ ─────────────────────────────── │   │
│  │ [♡ 42]    [🔖]    [↗ Share]    │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ [Next passage card...]          │   │
│  └─────────────────────────────────┘   │
│                                         │
│         [Loading spinner...]            │
│                                         │
└─────────────────────────────────────────┘
```

### 2.3 Passage Card Anatomy

```
┌─────────────────────────────────────────┐
│ [Avatar]  Author Name  · Work Title     │  ← Tappable (author/work pages)
│ ─────────────────────────────────────── │
│                                         │
│ Passage text here. This is the main     │  ← Tappable (passage detail)
│ content that users scroll through.      │
│ Can be short quotes or longer excerpts. │
│                                         │
│ ─────────────────────────────────────── │
│ [♡ 42]        [🔖]           [↗]       │  ← Action buttons
└─────────────────────────────────────────┘
```

**Avatar:** Circle with author's initials (first letters of first/last name)

**Actions:**
- Heart: Like (toggle, shows count)
- Bookmark: Save for later (toggle)
- Share: Native share sheet

### 2.4 Navigation Structure

```
Main Navigation (Tab Bar / Bottom Nav):
├── Home (Feed)
├── Search
├── Bookmarks
├── Lists
└── Profile

Secondary Screens:
├── Author Page (from tapping author name)
├── Work Page (from tapping work title)
├── Passage Detail (from tapping passage)
├── Work Reader (sequential reading)
├── Login/Signup
└── Settings (legal links, account deletion)
```

### 2.5 Authentication Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Launch    │────▶│  Check for  │────▶│  Has Token? │
│    App      │     │   Token     │     │             │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
                    ┌──────────────────────────┼──────────────────────────┐
                    │ Yes                      │                     No   │
                    ▼                          │                          ▼
           ┌─────────────┐                     │                 ┌─────────────┐
           │ Refresh     │                     │                 │ Show Feed   │
           │ Token       │                     │                 │ (Anonymous) │
           └──────┬──────┘                     │                 └─────────────┘
                  │                            │
         ┌────────┴────────┐                   │
         │ Valid           │ Invalid           │
         ▼                 ▼                   │
┌─────────────┐   ┌─────────────┐              │
│ Show Feed   │   │ Clear Token │              │
│ (Logged In) │   │ Show Login  │◀─────────────┘
└─────────────┘   └─────────────┘
```

### 2.6 Data Sync Strategy

**Anonymous Users:**
- Likes and bookmarks stored locally
- Feed works but no personalization

**Logged-in Users:**
- On login: Sync local data to server
- All new interactions: Save to server + local
- Server is source of truth
- Local cache for offline reading

---

## 3. API Reference

### 3.1 Authentication

**Headers Required:**
```
Authorization: Bearer <access_token>
X-Device-ID: <uuid>  (generate once, store permanently)
Content-Type: application/json
```

**Token Strategy:**
- Access token: 15 minute expiry, stored in memory
- Refresh token: 7 day expiry, stored securely (Keychain/SharedPrefs)

#### POST /api/auth/signup
Create new account.

```json
Request:
{
  "email": "user@example.com",
  "password": "min8chars",
  "displayName": "Optional Name"
}

Response 201:
{
  "user": {
    "id": "user-123",
    "email": "user@example.com",
    "displayName": "Optional Name"
  },
  "accessToken": "eyJ..."
}
+ Set-Cookie: refreshToken=...; HttpOnly; Secure
```

#### POST /api/auth/login
Login existing user.

```json
Request:
{
  "email": "user@example.com",
  "password": "password123"
}

Response 200:
{
  "user": { ... },
  "accessToken": "eyJ..."
}
+ Set-Cookie: refreshToken=...
```

#### POST /api/auth/logout
Logout and revoke refresh token.

```
Request: (no body)
Authorization: Bearer <token>

Response 200:
{ "success": true }
```

#### POST /api/auth/refresh
Get new access token using refresh token cookie.

```
Request: (no body, uses cookie)

Response 200:
{ "accessToken": "eyJ..." }
```

#### GET /api/auth/me
Get current user profile.

```
Authorization: Bearer <token>

Response 200:
{
  "user": {
    "id": "user-123",
    "email": "user@example.com",
    "displayName": "Name",
    "createdAt": "2026-01-13T..."
  }
}
```

#### DELETE /api/auth/me
**Delete user account** (Required for App Store compliance).

```
Authorization: Bearer <token>

Response 200:
{
  "success": true,
  "message": "Account deleted successfully"
}
```

**Data deleted:**
- User account
- All likes
- All bookmarks
- All reading lists
- Reading progress
- Author follows
- Refresh tokens

### 3.2 Feed Endpoints

#### GET /api/feed
Main feed with cursor pagination.

```
Query params:
- limit: number (default: 20, max: 50)
- cursor: string (base64 pagination token)
- category: string (category slug)

Response 200:
{
  "passages": [
    {
      "id": "chunk-123",
      "text": "The passage text...",
      "type": "quote",
      "author": {
        "id": "author-1",
        "name": "Marcus Aurelius",
        "slug": "marcus-aurelius"
      },
      "work": {
        "id": "work-1",
        "title": "Meditations",
        "slug": "meditations"
      },
      "likeCount": 42,
      "isLiked": false,
      "isBookmarked": false
    }
  ],
  "nextCursor": "eyJ...",
  "hasMore": true
}
```

#### GET /api/feed/following
Feed from followed authors only (requires auth).

```
Same response format as /api/feed
```

#### GET /api/feed/for-you
Personalized feed (requires auth + enough signals).

```
Same response format as /api/feed
```

### 3.3 Categories

#### GET /api/categories
List all categories.

```
Response 200:
{
  "categories": [
    {
      "id": "cat-1",
      "name": "Philosophy",
      "slug": "philosophy",
      "icon": "🧠",
      "workCount": 245
    }
  ]
}
```

### 3.4 Authors

#### GET /api/authors/:slug
Get author details.

```
Response 200:
{
  "author": {
    "id": "author-1",
    "name": "Marcus Aurelius",
    "slug": "marcus-aurelius",
    "birthYear": 121,
    "deathYear": 180,
    "era": "Ancient",
    "nationality": "Roman",
    "primaryGenre": "Philosophy",
    "followerCount": 1234,
    "isFollowing": false
  },
  "works": [
    {
      "id": "work-1",
      "title": "Meditations",
      "slug": "meditations",
      "year": 180,
      "passageCount": 312
    }
  ]
}
```

#### POST /api/authors/:slug/follow
Follow an author (requires auth).

```
Response 200:
{ "success": true, "followerCount": 1235 }
```

#### DELETE /api/authors/:slug/follow
Unfollow an author.

```
Response 200:
{ "success": true, "followerCount": 1234 }
```

### 3.5 Works

#### GET /api/works/:slug
Get work details.

```
Response 200:
{
  "work": {
    "id": "work-1",
    "title": "Meditations",
    "slug": "meditations",
    "year": 180,
    "type": "philosophy",
    "genre": "Philosophy",
    "passageCount": 312,
    "author": {
      "id": "author-1",
      "name": "Marcus Aurelius",
      "slug": "marcus-aurelius"
    }
  }
}
```

#### GET /api/works/:slug/chunks
Get passages from work (paginated).

```
Query params:
- start: number (index to start from)
- limit: number (default: 20)

Response 200:
{
  "chunks": [
    {
      "id": "chunk-1",
      "text": "...",
      "index": 0,
      "type": "passage"
    }
  ],
  "total": 312,
  "hasMore": true
}
```

#### GET /api/works/:slug/read
Get work for sequential reading (requires auth).

```
Response 200:
{
  "work": { ... },
  "totalChunks": 312,
  "userProgress": {
    "currentIndex": 46,
    "lastReadAt": "2026-01-13T...",
    "percentComplete": 15,
    "completedAt": null
  }
}
```

#### POST /api/works/:slug/progress
Update reading progress.

```json
Request:
{ "currentIndex": 47 }

Response 200:
{ "success": true }
```

### 3.6 User Data

#### POST /api/passages/:id/like
Like a passage (requires auth).

```
Response 200:
{ "success": true, "likeCount": 43 }
```

#### DELETE /api/passages/:id/like
Unlike a passage.

```
Response 200:
{ "success": true, "likeCount": 42 }
```

#### POST /api/passages/:id/bookmark
Bookmark a passage.

```
Response 200:
{ "success": true }
```

#### DELETE /api/passages/:id/bookmark
Remove bookmark.

```
Response 200:
{ "success": true }
```

#### GET /api/user/likes
Get user's liked passages.

```
Response 200:
{
  "likes": [
    { "chunkId": "chunk-1", "createdAt": "..." }
  ]
}
```

#### GET /api/user/bookmarks
Get user's bookmarks.

```
Response 200:
{
  "bookmarks": [
    {
      "id": "chunk-1",
      "text": "...",
      "author": { ... },
      "work": { ... },
      "createdAt": "..."
    }
  ]
}
```

#### POST /api/user/likes/sync
Sync local likes to server (call after signup/login).

```json
Request:
{
  "likes": [
    { "chunkId": "chunk-1", "createdAt": "2026-01-13T..." }
  ]
}

Response 200:
{ "synced": 5 }
```

#### POST /api/user/bookmarks/sync
Sync local bookmarks to server.

```json
Request:
{
  "bookmarks": [
    { "chunkId": "chunk-1", "createdAt": "2026-01-13T..." }
  ]
}

Response 200:
{ "synced": 3 }
```

#### GET /api/user/stats
Get user statistics.

```
Response 200:
{
  "stats": {
    "totalLikes": 42,
    "totalBookmarks": 15,
    "authorsFollowing": 8,
    "listsCreated": 3,
    "worksInProgress": 2,
    "worksCompleted": 1
  }
}
```

### 3.7 Lists

#### GET /api/lists
Get user's lists.

```
Response 200:
{
  "lists": [
    {
      "id": "list-1",
      "name": "My Favorites",
      "description": "...",
      "isPublic": false,
      "passageCount": 12,
      "createdAt": "..."
    }
  ]
}
```

#### POST /api/lists
Create new list.

```json
Request:
{
  "name": "My Favorites",
  "description": "Optional description",
  "isPublic": false
}

Response 201:
{ "list": { ... } }
```

#### GET /api/lists/:idOrSlug
Get list with passages.

```
Response 200:
{
  "list": { ... },
  "passages": [ ... ]
}
```

#### POST /api/lists/:idOrSlug/passages
Add passage to list.

```json
Request:
{ "chunkId": "chunk-123" }

Response 200:
{ "success": true }
```

#### DELETE /api/lists/:idOrSlug/passages/:chunkId
Remove passage from list.

#### GET /api/lists/curated
Get featured/editorial lists.

### 3.8 Search

#### GET /api/search
Unified search across passages, authors, works.

```
Query params:
- q: string (search query)
- limit: number (default: 20)

Response 200:
{
  "query": "marcus aurelius",
  "results": [
    {
      "type": "author",
      "author": { ... },
      "score": 0.95
    },
    {
      "type": "work",
      "work": { ... },
      "score": 0.88
    },
    {
      "type": "passage",
      "passage": { ... },
      "score": 0.72
    }
  ],
  "total": 47,
  "method": "hybrid"
}
```

### 3.9 Similar Passages

#### GET /api/passages/:id/similar
Find passages similar to a given passage.

```
Query params:
- limit: number (default: 10)

Response 200:
{
  "passage": { ... },
  "similar": [
    {
      "id": "chunk-456",
      "text": "...",
      "author": { ... },
      "work": { ... },
      "similarity": "0.89"
    }
  ],
  "method": "embedding"
}
```

### 3.10 Discovery

#### GET /api/discover/authors
Get featured authors for discovery panel.

```
Query params:
- limit: number (default: 5)

Response 200:
{
  "authors": [ ... ]
}
```

#### GET /api/discover/popular
Get most liked passages.

```
Response 200:
{
  "passages": [ ... ]
}
```

### 3.11 Legal Documents

#### GET /legal/privacy
Returns Privacy Policy HTML page.

#### GET /legal/terms
Returns Terms of Service HTML page.

---

## 4. Compliance Requirements

### 4.1 All Platforms

| Requirement | Description |
|-------------|-------------|
| Privacy Policy | Link to `/legal/privacy` |
| Terms of Service | Link to `/legal/terms` |
| Account Deletion | In-app deletion via `DELETE /api/auth/me` |
| Copyright | "© 2026 DDP" |

### 4.2 Footer Format (Recommended)

```
Scroll with purpose.
Privacy | Terms | © 2026 DDP
```

### 4.3 Account Deletion Flow

Required by Apple since 2022 for any app with user accounts.

```
┌─────────────────────────────────────────┐
│  Settings                               │
├─────────────────────────────────────────┤
│                                         │
│  Account Settings                       │
│  ─────────────────────────────────────  │
│                                         │
│  [ Display Name ]                       │
│  [ Change Password ]                    │
│                                         │
│  ─────────────────────────────────────  │
│                                         │
│  Danger Zone                            │ ← Red styling
│  ─────────────────────────────────────  │
│                                         │
│  [ Delete Account ]                     │ ← Red button
│                                         │
│  Permanently delete your account        │
│  and all data.                          │
│                                         │
└─────────────────────────────────────────┘
```

**Confirmation Dialog:**
```
┌─────────────────────────────────────────┐
│  Delete Account?                        │
├─────────────────────────────────────────┤
│                                         │
│  This will permanently delete your      │
│  account and all data including:        │
│                                         │
│  • All liked passages                   │
│  • All bookmarks                        │
│  • All reading lists                    │
│  • Reading progress                     │
│  • Author follows                       │
│                                         │
│  This action cannot be undone.          │ ← Red text
│                                         │
│  [ Cancel ]         [ Delete Account ]  │
│                              ↑ Red      │
└─────────────────────────────────────────┘
```

**After Deletion:**
1. Clear all local data (Keychain, UserDefaults, cache)
2. Navigate to home/onboarding screen
3. Show anonymous feed

---

## 5. iOS Implementation

### 5.1 Project Setup

**Requirements:**
- iOS 15.0+ (for modern SwiftUI)
- Swift 5.9+
- Xcode 15+

**Dependencies (Swift Package Manager):**
```swift
// None required - use native URLSession and SwiftUI
// Optional: Kingfisher for image caching if needed
```

**Project Structure:**
```
Doomscrolls/
├── App/
│   ├── DoomscrollsApp.swift
│   └── ContentView.swift
├── Models/
│   ├── Passage.swift
│   ├── Author.swift
│   ├── Work.swift
│   ├── User.swift
│   └── APIResponse.swift
├── Services/
│   ├── APIClient.swift
│   ├── AuthService.swift
│   └── KeychainHelper.swift
├── Views/
│   ├── Feed/
│   │   ├── FeedView.swift
│   │   ├── PassageCard.swift
│   │   └── CategoryTabs.swift
│   ├── Author/
│   │   └── AuthorView.swift
│   ├── Work/
│   │   ├── WorkView.swift
│   │   └── WorkReader.swift
│   ├── Search/
│   │   └── SearchView.swift
│   ├── Lists/
│   │   ├── ListsView.swift
│   │   └── ListDetailView.swift
│   ├── Profile/
│   │   ├── ProfileView.swift
│   │   └── SettingsView.swift
│   └── Auth/
│       ├── LoginView.swift
│       └── SignupView.swift
├── ViewModels/
│   ├── FeedViewModel.swift
│   ├── AuthViewModel.swift
│   └── UserViewModel.swift
└── Utilities/
    ├── Extensions.swift
    └── Constants.swift
```

### 5.2 Key Code Patterns

**API Client:**
```swift
// Services/APIClient.swift
import Foundation

class APIClient {
    static let shared = APIClient()
    private let baseURL = "https://your-domain.com/api"
    private var accessToken: String?
    private let deviceId: String

    private init() {
        // Generate or retrieve stored device ID
        if let stored = UserDefaults.standard.string(forKey: "deviceId") {
            deviceId = stored
        } else {
            deviceId = UUID().uuidString
            UserDefaults.standard.set(deviceId, forKey: "deviceId")
        }
    }

    func setAccessToken(_ token: String?) {
        accessToken = token
    }

    func request<T: Decodable>(_ endpoint: String, method: String = "GET", body: Data? = nil) async throws -> T {
        guard let url = URL(string: "\(baseURL)\(endpoint)") else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(deviceId, forHTTPHeaderField: "X-Device-ID")

        if let token = accessToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        if let body = body {
            request.httpBody = body
        }

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        if httpResponse.statusCode == 401 {
            // Try to refresh token
            try await refreshToken()
            return try await self.request(endpoint, method: method, body: body)
        }

        guard 200...299 ~= httpResponse.statusCode else {
            throw APIError.httpError(httpResponse.statusCode)
        }

        return try JSONDecoder().decode(T.self, from: data)
    }

    private func refreshToken() async throws {
        // Implementation using refresh token from Keychain
    }
}
```

**Passage Card:**
```swift
// Views/Feed/PassageCard.swift
import SwiftUI

struct PassageCard: View {
    let passage: Passage
    @State private var isLiked: Bool
    @State private var isBookmarked: Bool
    @State private var likeCount: Int

    init(passage: Passage) {
        self.passage = passage
        _isLiked = State(initialValue: passage.isLiked)
        _isBookmarked = State(initialValue: passage.isBookmarked)
        _likeCount = State(initialValue: passage.likeCount)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Header: Avatar + Author + Work
            HStack {
                Circle()
                    .fill(Color.gray.opacity(0.3))
                    .frame(width: 40, height: 40)
                    .overlay(
                        Text(passage.author.initials)
                            .font(.system(size: 16, weight: .bold))
                    )

                VStack(alignment: .leading, spacing: 2) {
                    Text(passage.author.name)
                        .font(.system(size: 15, weight: .semibold))
                    Text(passage.work.title)
                        .font(.system(size: 13))
                        .foregroundColor(.secondary)
                }

                Spacer()
            }

            // Passage text
            Text(passage.text)
                .font(.system(size: 16))
                .lineSpacing(4)

            // Action buttons
            HStack(spacing: 24) {
                Button(action: toggleLike) {
                    HStack(spacing: 4) {
                        Image(systemName: isLiked ? "heart.fill" : "heart")
                            .foregroundColor(isLiked ? .red : .secondary)
                        Text("\(likeCount)")
                            .font(.system(size: 14))
                            .foregroundColor(.secondary)
                    }
                }

                Button(action: toggleBookmark) {
                    Image(systemName: isBookmarked ? "bookmark.fill" : "bookmark")
                        .foregroundColor(isBookmarked ? .blue : .secondary)
                }

                Button(action: sharePassage) {
                    Image(systemName: "square.and.arrow.up")
                        .foregroundColor(.secondary)
                }

                Spacer()
            }
        }
        .padding()
        .background(Color(.systemBackground))
    }

    private func toggleLike() {
        // Optimistic update
        isLiked.toggle()
        likeCount += isLiked ? 1 : -1

        Task {
            do {
                if isLiked {
                    try await APIClient.shared.request("/passages/\(passage.id)/like", method: "POST")
                } else {
                    try await APIClient.shared.request("/passages/\(passage.id)/like", method: "DELETE")
                }
            } catch {
                // Revert on error
                isLiked.toggle()
                likeCount += isLiked ? 1 : -1
            }
        }
    }

    private func toggleBookmark() {
        isBookmarked.toggle()

        Task {
            do {
                if isBookmarked {
                    try await APIClient.shared.request("/passages/\(passage.id)/bookmark", method: "POST")
                } else {
                    try await APIClient.shared.request("/passages/\(passage.id)/bookmark", method: "DELETE")
                }
            } catch {
                isBookmarked.toggle()
            }
        }
    }

    private func sharePassage() {
        let text = "\"\(passage.text)\"\n\n— \(passage.author.name), \(passage.work.title)"
        let activityVC = UIActivityViewController(activityItems: [text], applicationActivities: nil)

        if let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
           let window = windowScene.windows.first,
           let rootVC = window.rootViewController {
            rootVC.present(activityVC, animated: true)
        }
    }
}
```

**Account Deletion:**
```swift
// Views/Profile/SettingsView.swift

struct SettingsView: View {
    @EnvironmentObject var authViewModel: AuthViewModel
    @State private var showDeleteConfirmation = false
    @State private var isDeleting = false

    var body: some View {
        Form {
            // ... other settings ...

            Section {
                Button("Delete Account", role: .destructive) {
                    showDeleteConfirmation = true
                }
            } header: {
                Text("Danger Zone")
            } footer: {
                Text("Permanently delete your account and all data.")
            }
        }
        .confirmationDialog("Delete Account?", isPresented: $showDeleteConfirmation, titleVisibility: .visible) {
            Button("Delete Account", role: .destructive) {
                Task { await deleteAccount() }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This will permanently delete your account and all data including likes, bookmarks, lists, and reading progress.\n\nThis cannot be undone.")
        }
    }

    private func deleteAccount() async {
        isDeleting = true
        defer { isDeleting = false }

        do {
            let _: DeleteResponse = try await APIClient.shared.request("/auth/me", method: "DELETE")

            // Clear all local data
            KeychainHelper.delete("accessToken")
            KeychainHelper.delete("refreshToken")
            UserDefaults.standard.removePersistentDomain(forName: Bundle.main.bundleIdentifier!)

            // Clear API client
            APIClient.shared.setAccessToken(nil)

            // Update auth state (triggers navigation to home)
            await MainActor.run {
                authViewModel.logout()
            }
        } catch {
            // Show error alert
        }
    }
}
```

**Legal Links:**
```swift
// In Settings or About view
import SafariServices

struct LegalLinksView: View {
    @State private var showPrivacy = false
    @State private var showTerms = false

    var body: some View {
        Section("Legal") {
            Button("Privacy Policy") {
                showPrivacy = true
            }
            .sheet(isPresented: $showPrivacy) {
                SafariView(url: URL(string: "https://your-domain.com/legal/privacy")!)
            }

            Button("Terms of Service") {
                showTerms = true
            }
            .sheet(isPresented: $showTerms) {
                SafariView(url: URL(string: "https://your-domain.com/legal/terms")!)
            }
        }
    }
}

struct SafariView: UIViewControllerRepresentable {
    let url: URL

    func makeUIViewController(context: Context) -> SFSafariViewController {
        SFSafariViewController(url: url)
    }

    func updateUIViewController(_ uiViewController: SFSafariViewController, context: Context) {}
}
```

### 5.3 iOS-Specific Requirements

| Requirement | Implementation |
|-------------|----------------|
| App Icon | 1024x1024 @1x (App Store), scales down |
| Privacy Policy URL | Required in App Store Connect |
| In-App Deletion | Required since 2022 |
| Keychain | Store tokens securely |
| Dark Mode | Support automatic switching |

### 5.4 Info.plist Additions

```xml
<key>ITSAppUsesNonExemptEncryption</key>
<false/>

<key>NSAppTransportSecurity</key>
<dict>
    <key>NSAllowsArbitraryLoads</key>
    <false/>
</dict>
```

---

## 6. Android Implementation

### 6.1 Project Setup

**Requirements:**
- Min SDK 24 (Android 7.0)
- Target SDK 34 (Android 14)
- Kotlin 1.9+
- Jetpack Compose

**Dependencies (build.gradle.kts):**
```kotlin
dependencies {
    // Compose
    implementation(platform("androidx.compose:compose-bom:2024.01.00"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.activity:activity-compose:1.8.2")
    implementation("androidx.navigation:navigation-compose:2.7.6")

    // Networking
    implementation("com.squareup.retrofit2:retrofit:2.9.0")
    implementation("com.squareup.retrofit2:converter-gson:2.9.0")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.squareup.okhttp3:logging-interceptor:4.12.0")

    // Coroutines
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3")

    // ViewModel
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.7.0")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.7.0")

    // DataStore (for preferences)
    implementation("androidx.datastore:datastore-preferences:1.0.0")

    // Security (for encrypted SharedPreferences)
    implementation("androidx.security:security-crypto:1.1.0-alpha06")
}
```

**Project Structure:**
```
app/src/main/java/com/doomscrolls/
├── DoomscrollsApp.kt
├── MainActivity.kt
├── data/
│   ├── api/
│   │   ├── ApiService.kt
│   │   ├── ApiClient.kt
│   │   └── AuthInterceptor.kt
│   ├── models/
│   │   ├── Passage.kt
│   │   ├── Author.kt
│   │   └── User.kt
│   └── repository/
│       ├── FeedRepository.kt
│       ├── AuthRepository.kt
│       └── UserRepository.kt
├── ui/
│   ├── theme/
│   │   └── Theme.kt
│   ├── navigation/
│   │   └── NavGraph.kt
│   ├── feed/
│   │   ├── FeedScreen.kt
│   │   ├── FeedViewModel.kt
│   │   └── PassageCard.kt
│   ├── author/
│   │   └── AuthorScreen.kt
│   ├── work/
│   │   ├── WorkScreen.kt
│   │   └── WorkReaderScreen.kt
│   ├── search/
│   │   └── SearchScreen.kt
│   ├── lists/
│   │   └── ListsScreen.kt
│   ├── profile/
│   │   ├── ProfileScreen.kt
│   │   └── SettingsScreen.kt
│   └── auth/
│       ├── LoginScreen.kt
│       └── SignupScreen.kt
└── util/
    ├── TokenManager.kt
    └── Extensions.kt
```

### 6.2 Key Code Patterns

**API Service:**
```kotlin
// data/api/ApiService.kt
interface ApiService {
    @GET("feed")
    suspend fun getFeed(
        @Query("limit") limit: Int = 20,
        @Query("cursor") cursor: String? = null,
        @Query("category") category: String? = null
    ): FeedResponse

    @POST("auth/login")
    suspend fun login(@Body request: LoginRequest): AuthResponse

    @POST("auth/signup")
    suspend fun signup(@Body request: SignupRequest): AuthResponse

    @DELETE("auth/me")
    suspend fun deleteAccount(): DeleteResponse

    @POST("passages/{id}/like")
    suspend fun likePassage(@Path("id") id: String): LikeResponse

    @DELETE("passages/{id}/like")
    suspend fun unlikePassage(@Path("id") id: String): LikeResponse

    @POST("passages/{id}/bookmark")
    suspend fun bookmarkPassage(@Path("id") id: String): Response<Unit>

    @DELETE("passages/{id}/bookmark")
    suspend fun unbookmarkPassage(@Path("id") id: String): Response<Unit>

    @GET("search")
    suspend fun search(
        @Query("q") query: String,
        @Query("limit") limit: Int = 20
    ): SearchResponse
}
```

**Auth Interceptor:**
```kotlin
// data/api/AuthInterceptor.kt
class AuthInterceptor(
    private val tokenManager: TokenManager
) : Interceptor {

    override fun intercept(chain: Interceptor.Chain): Response {
        val originalRequest = chain.request()

        val requestBuilder = originalRequest.newBuilder()
            .header("Content-Type", "application/json")
            .header("X-Device-ID", tokenManager.getDeviceId())

        tokenManager.getAccessToken()?.let { token ->
            requestBuilder.header("Authorization", "Bearer $token")
        }

        val response = chain.proceed(requestBuilder.build())

        // Handle 401 - refresh token
        if (response.code == 401) {
            synchronized(this) {
                val newToken = runBlocking { tokenManager.refreshToken() }
                if (newToken != null) {
                    val newRequest = originalRequest.newBuilder()
                        .header("Authorization", "Bearer $newToken")
                        .build()
                    response.close()
                    return chain.proceed(newRequest)
                }
            }
        }

        return response
    }
}
```

**Passage Card:**
```kotlin
// ui/feed/PassageCard.kt
@Composable
fun PassageCard(
    passage: Passage,
    onAuthorClick: (String) -> Unit,
    onWorkClick: (String) -> Unit,
    onPassageClick: (String) -> Unit,
    viewModel: FeedViewModel = hiltViewModel()
) {
    var isLiked by remember { mutableStateOf(passage.isLiked) }
    var isBookmarked by remember { mutableStateOf(passage.isBookmarked) }
    var likeCount by remember { mutableIntStateOf(passage.likeCount) }
    val context = LocalContext.current

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onPassageClick(passage.id) },
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        )
    ) {
        Column(
            modifier = Modifier.padding(16.dp)
        ) {
            // Header: Avatar + Author + Work
            Row(
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    modifier = Modifier
                        .size(40.dp)
                        .clip(CircleShape)
                        .background(MaterialTheme.colorScheme.surfaceVariant),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = passage.author.initials,
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold
                    )
                }

                Spacer(modifier = Modifier.width(12.dp))

                Column {
                    Text(
                        text = passage.author.name,
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.clickable { onAuthorClick(passage.author.slug) }
                    )
                    Text(
                        text = passage.work.title,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.clickable { onWorkClick(passage.work.slug) }
                    )
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Passage text
            Text(
                text = passage.text,
                style = MaterialTheme.typography.bodyLarge,
                lineHeight = 24.sp
            )

            Spacer(modifier = Modifier.height(12.dp))

            // Action buttons
            Row(
                horizontalArrangement = Arrangement.spacedBy(24.dp)
            ) {
                // Like button
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.clickable {
                        isLiked = !isLiked
                        likeCount += if (isLiked) 1 else -1
                        viewModel.toggleLike(passage.id, isLiked)
                    }
                ) {
                    Icon(
                        imageVector = if (isLiked) Icons.Filled.Favorite else Icons.Outlined.FavoriteBorder,
                        contentDescription = "Like",
                        tint = if (isLiked) Color.Red else MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = "$likeCount",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                // Bookmark button
                Icon(
                    imageVector = if (isBookmarked) Icons.Filled.Bookmark else Icons.Outlined.BookmarkBorder,
                    contentDescription = "Bookmark",
                    tint = if (isBookmarked) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier
                        .size(20.dp)
                        .clickable {
                            isBookmarked = !isBookmarked
                            viewModel.toggleBookmark(passage.id, isBookmarked)
                        }
                )

                // Share button
                Icon(
                    imageVector = Icons.Outlined.Share,
                    contentDescription = "Share",
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier
                        .size(20.dp)
                        .clickable {
                            val text = "\"${passage.text}\"\n\n— ${passage.author.name}, ${passage.work.title}"
                            val intent = Intent(Intent.ACTION_SEND).apply {
                                type = "text/plain"
                                putExtra(Intent.EXTRA_TEXT, text)
                            }
                            context.startActivity(Intent.createChooser(intent, "Share passage"))
                        }
                )
            }
        }
    }
}
```

**Account Deletion:**
```kotlin
// ui/profile/SettingsScreen.kt
@Composable
fun SettingsScreen(
    viewModel: SettingsViewModel = hiltViewModel(),
    onAccountDeleted: () -> Unit
) {
    var showDeleteDialog by remember { mutableStateOf(false) }
    val isDeleting by viewModel.isDeleting.collectAsState()
    val context = LocalContext.current

    Column(modifier = Modifier.fillMaxSize()) {
        // ... other settings ...

        Spacer(modifier = Modifier.height(32.dp))

        // Danger Zone
        Text(
            text = "Danger Zone",
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.error,
            modifier = Modifier.padding(horizontal = 16.dp)
        )

        Spacer(modifier = Modifier.height(8.dp))

        Card(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp),
            colors = CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.3f)
            )
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text(
                    text = "Delete Account",
                    style = MaterialTheme.typography.titleSmall,
                    color = MaterialTheme.colorScheme.error
                )
                Text(
                    text = "Permanently delete your account and all data.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(modifier = Modifier.height(12.dp))
                Button(
                    onClick = { showDeleteDialog = true },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.error
                    ),
                    enabled = !isDeleting
                ) {
                    if (isDeleting) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(16.dp),
                            color = MaterialTheme.colorScheme.onError
                        )
                    } else {
                        Text("Delete Account")
                    }
                }
            }
        }
    }

    if (showDeleteDialog) {
        AlertDialog(
            onDismissRequest = { showDeleteDialog = false },
            title = { Text("Delete Account?") },
            text = {
                Column {
                    Text("This will permanently delete your account and all data including:")
                    Spacer(modifier = Modifier.height(8.dp))
                    listOf(
                        "All liked passages",
                        "All bookmarks",
                        "All reading lists",
                        "Reading progress",
                        "Author follows"
                    ).forEach { item ->
                        Text("• $item", style = MaterialTheme.typography.bodySmall)
                    }
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        "This action cannot be undone.",
                        color = MaterialTheme.colorScheme.error,
                        fontWeight = FontWeight.SemiBold
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        showDeleteDialog = false
                        viewModel.deleteAccount {
                            onAccountDeleted()
                        }
                    },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.error
                    )
                ) {
                    Text("Delete")
                }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteDialog = false }) {
                    Text("Cancel")
                }
            }
        )
    }
}

// SettingsViewModel.kt
@HiltViewModel
class SettingsViewModel @Inject constructor(
    private val authRepository: AuthRepository,
    private val tokenManager: TokenManager
) : ViewModel() {

    private val _isDeleting = MutableStateFlow(false)
    val isDeleting: StateFlow<Boolean> = _isDeleting

    fun deleteAccount(onSuccess: () -> Unit) {
        viewModelScope.launch {
            _isDeleting.value = true
            try {
                authRepository.deleteAccount()

                // Clear all local data
                tokenManager.clearAll()

                onSuccess()
            } catch (e: Exception) {
                // Show error
            } finally {
                _isDeleting.value = false
            }
        }
    }
}
```

**Legal Links:**
```kotlin
// ui/profile/SettingsScreen.kt (continued)

@Composable
fun LegalSection() {
    val context = LocalContext.current

    Column {
        Text(
            text = "Legal",
            style = MaterialTheme.typography.titleMedium,
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
        )

        ListItem(
            headlineContent = { Text("Privacy Policy") },
            modifier = Modifier.clickable {
                openInBrowser(context, "https://your-domain.com/legal/privacy")
            }
        )

        ListItem(
            headlineContent = { Text("Terms of Service") },
            modifier = Modifier.clickable {
                openInBrowser(context, "https://your-domain.com/legal/terms")
            }
        )
    }
}

private fun openInBrowser(context: Context, url: String) {
    // Try Chrome Custom Tabs first
    try {
        val customTabsIntent = CustomTabsIntent.Builder()
            .setShowTitle(true)
            .build()
        customTabsIntent.launchUrl(context, Uri.parse(url))
    } catch (e: Exception) {
        // Fallback to regular browser
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
        context.startActivity(intent)
    }
}
```

### 6.3 Android-Specific Requirements

| Requirement | Implementation |
|-------------|----------------|
| App Icon | Adaptive icon (foreground + background) |
| Privacy Policy URL | Required in Play Console |
| In-App Deletion | Required by Google Play |
| Web Deletion URL | Required by Google Play (can use /legal/privacy) |
| Data Safety Form | Complete in Play Console |
| EncryptedSharedPreferences | Store tokens securely |

### 6.4 AndroidManifest.xml

```xml
<manifest>
    <uses-permission android:name="android.permission.INTERNET" />

    <application
        android:usesCleartextTraffic="false"
        android:networkSecurityConfig="@xml/network_security_config"
        ...>

        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:theme="@style/Theme.Doomscrolls">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
```

### 6.5 Data Safety Form Answers

| Question | Answer |
|----------|--------|
| Data collected | Email (account), User activity (likes, bookmarks) |
| Data shared | None |
| Data encrypted in transit | Yes |
| Users can request deletion | Yes |
| Deletion URL | https://your-domain.com/legal/privacy |

---

## 7. Chrome Extension Implementation

### 7.1 Project Setup

**Manifest V3 Required**

**Project Structure:**
```
doomscrolls-extension/
├── manifest.json
├── popup/
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── background/
│   └── service-worker.js
├── content/
│   └── content.js (optional)
├── options/
│   ├── options.html
│   └── options.js
├── lib/
│   └── api.js
├── icons/
│   ├── icon-16.png
│   ├── icon-32.png
│   ├── icon-48.png
│   └── icon-128.png
└── styles/
    └── common.css
```

### 7.2 manifest.json

```json
{
  "manifest_version": 3,
  "name": "Doomscrolls",
  "version": "1.0.0",
  "description": "Classical literature in your browser. Scroll with purpose.",

  "permissions": [
    "storage"
  ],

  "host_permissions": [
    "https://your-domain.com/*"
  ],

  "action": {
    "default_popup": "popup/popup.html",
    "default_icon": {
      "16": "icons/icon-16.png",
      "32": "icons/icon-32.png",
      "48": "icons/icon-48.png",
      "128": "icons/icon-128.png"
    }
  },

  "background": {
    "service_worker": "background/service-worker.js"
  },

  "options_page": "options/options.html",

  "icons": {
    "16": "icons/icon-16.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  }
}
```

### 7.3 Popup Implementation

**popup.html:**
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="popup.css">
  <title>Doomscrolls</title>
</head>
<body>
  <div class="container">
    <header class="header">
      <h1>Doomscrolls</h1>
      <button id="refreshBtn" class="icon-btn" title="Refresh">↻</button>
    </header>

    <main class="content">
      <div id="loading" class="loading">Loading...</div>
      <div id="passage" class="passage hidden">
        <div class="author-line">
          <span class="avatar" id="avatar"></span>
          <span class="author" id="author"></span>
          <span class="separator">·</span>
          <span class="work" id="work"></span>
        </div>
        <p class="text" id="text"></p>
        <div class="actions">
          <button id="likeBtn" class="action-btn">
            <span class="heart">♡</span>
            <span id="likeCount">0</span>
          </button>
          <button id="bookmarkBtn" class="action-btn">🔖</button>
          <button id="shareBtn" class="action-btn">↗</button>
        </div>
      </div>
    </main>

    <footer class="footer">
      <div>Scroll with purpose.</div>
      <div>
        <a href="https://your-domain.com/legal/privacy" target="_blank">Privacy</a>
        <span>|</span>
        <a href="https://your-domain.com/legal/terms" target="_blank">Terms</a>
        <span>|</span>
        <span>© 2026 DDP</span>
      </div>
    </footer>
  </div>

  <script src="../lib/api.js"></script>
  <script src="popup.js"></script>
</body>
</html>
```

**popup.css:**
```css
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  width: 360px;
  min-height: 400px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #1a1a1a;
  color: #e5e5e5;
}

.container {
  display: flex;
  flex-direction: column;
  min-height: 400px;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #333;
}

.header h1 {
  font-size: 18px;
  font-weight: 600;
}

.icon-btn {
  background: none;
  border: none;
  color: #888;
  font-size: 18px;
  cursor: pointer;
  padding: 4px;
}

.icon-btn:hover {
  color: #fff;
}

.content {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
}

.loading {
  text-align: center;
  color: #888;
  padding: 40px;
}

.passage {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.hidden {
  display: none;
}

.author-line {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #333;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 12px;
}

.author {
  font-weight: 600;
  color: #fff;
}

.separator {
  color: #666;
}

.work {
  color: #888;
}

.text {
  font-size: 15px;
  line-height: 1.5;
  color: #e5e5e5;
}

.actions {
  display: flex;
  gap: 20px;
  padding-top: 8px;
  border-top: 1px solid #333;
}

.action-btn {
  background: none;
  border: none;
  color: #888;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
}

.action-btn:hover {
  color: #fff;
}

.action-btn.liked .heart {
  color: #e53e3e;
}

.action-btn.bookmarked {
  color: #3b82f6;
}

.footer {
  padding: 12px 16px;
  border-top: 1px solid #333;
  font-size: 11px;
  color: #666;
}

.footer div {
  margin-bottom: 4px;
}

.footer div:last-child {
  margin-bottom: 0;
  display: flex;
  align-items: center;
  gap: 6px;
}

.footer a {
  color: #888;
  text-decoration: none;
}

.footer a:hover {
  color: #fff;
}
```

**popup.js:**
```javascript
// popup.js
let currentPassage = null;
let isLiked = false;
let isBookmarked = false;

document.addEventListener('DOMContentLoaded', async () => {
  await loadPassage();

  document.getElementById('refreshBtn').addEventListener('click', loadPassage);
  document.getElementById('likeBtn').addEventListener('click', toggleLike);
  document.getElementById('bookmarkBtn').addEventListener('click', toggleBookmark);
  document.getElementById('shareBtn').addEventListener('click', sharePassage);
});

async function loadPassage() {
  const loading = document.getElementById('loading');
  const passageEl = document.getElementById('passage');

  loading.classList.remove('hidden');
  passageEl.classList.add('hidden');

  try {
    const response = await api.getFeed(1);
    if (response.passages && response.passages.length > 0) {
      currentPassage = response.passages[0];
      displayPassage(currentPassage);
    }
  } catch (error) {
    console.error('Failed to load passage:', error);
    loading.textContent = 'Failed to load. Click refresh to try again.';
  }
}

function displayPassage(passage) {
  const loading = document.getElementById('loading');
  const passageEl = document.getElementById('passage');

  // Avatar
  const initials = passage.author.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .substring(0, 2);
  document.getElementById('avatar').textContent = initials;

  // Author and work
  document.getElementById('author').textContent = passage.author.name;
  document.getElementById('work').textContent = passage.work.title;

  // Text
  document.getElementById('text').textContent = passage.text;

  // Like count
  document.getElementById('likeCount').textContent = passage.likeCount;

  // Like/bookmark state
  isLiked = passage.isLiked || false;
  isBookmarked = passage.isBookmarked || false;
  updateButtons();

  loading.classList.add('hidden');
  passageEl.classList.remove('hidden');
}

function updateButtons() {
  const likeBtn = document.getElementById('likeBtn');
  const bookmarkBtn = document.getElementById('bookmarkBtn');

  if (isLiked) {
    likeBtn.classList.add('liked');
    likeBtn.querySelector('.heart').textContent = '♥';
  } else {
    likeBtn.classList.remove('liked');
    likeBtn.querySelector('.heart').textContent = '♡';
  }

  if (isBookmarked) {
    bookmarkBtn.classList.add('bookmarked');
  } else {
    bookmarkBtn.classList.remove('bookmarked');
  }
}

async function toggleLike() {
  if (!currentPassage) return;

  isLiked = !isLiked;
  const countEl = document.getElementById('likeCount');
  let count = parseInt(countEl.textContent);
  count += isLiked ? 1 : -1;
  countEl.textContent = count;
  updateButtons();

  try {
    if (isLiked) {
      await api.likePassage(currentPassage.id);
    } else {
      await api.unlikePassage(currentPassage.id);
    }
  } catch (error) {
    // Revert on error
    isLiked = !isLiked;
    count += isLiked ? 1 : -1;
    countEl.textContent = count;
    updateButtons();
  }
}

async function toggleBookmark() {
  if (!currentPassage) return;

  isBookmarked = !isBookmarked;
  updateButtons();

  try {
    if (isBookmarked) {
      await api.bookmarkPassage(currentPassage.id);
    } else {
      await api.unbookmarkPassage(currentPassage.id);
    }
  } catch (error) {
    isBookmarked = !isBookmarked;
    updateButtons();
  }
}

function sharePassage() {
  if (!currentPassage) return;

  const text = `"${currentPassage.text}"\n\n— ${currentPassage.author.name}, ${currentPassage.work.title}`;

  navigator.clipboard.writeText(text).then(() => {
    // Show copied feedback
    const shareBtn = document.getElementById('shareBtn');
    const original = shareBtn.textContent;
    shareBtn.textContent = '✓';
    setTimeout(() => {
      shareBtn.textContent = original;
    }, 1000);
  });
}
```

**lib/api.js:**
```javascript
// lib/api.js
const API_BASE = 'https://your-domain.com/api';

const api = {
  deviceId: null,
  accessToken: null,

  async init() {
    // Get or create device ID
    const stored = await chrome.storage.local.get(['deviceId', 'accessToken']);
    this.deviceId = stored.deviceId || crypto.randomUUID();
    this.accessToken = stored.accessToken || null;

    if (!stored.deviceId) {
      await chrome.storage.local.set({ deviceId: this.deviceId });
    }
  },

  async request(endpoint, options = {}) {
    await this.init();

    const headers = {
      'Content-Type': 'application/json',
      'X-Device-ID': this.deviceId,
      ...options.headers
    };

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return response.json();
  },

  async getFeed(limit = 1) {
    return this.request(`/feed?limit=${limit}`);
  },

  async likePassage(id) {
    return this.request(`/passages/${id}/like`, { method: 'POST' });
  },

  async unlikePassage(id) {
    return this.request(`/passages/${id}/like`, { method: 'DELETE' });
  },

  async bookmarkPassage(id) {
    return this.request(`/passages/${id}/bookmark`, { method: 'POST' });
  },

  async unbookmarkPassage(id) {
    return this.request(`/passages/${id}/bookmark`, { method: 'DELETE' });
  }
};
```

### 7.4 Chrome Extension-Specific Notes

| Feature | Implementation |
|---------|----------------|
| Account Management | Link to web app |
| Account Deletion | Link to web app profile page |
| Storage | chrome.storage.local for device ID |
| Auth | Optional - extension can work anonymously |

**For account deletion in extension:**
```html
<!-- In options.html or popup.html -->
<a href="https://your-domain.com/profile" target="_blank">Manage Account</a>
```

---

## 8. App Store Submission Checklists

### 8.1 iOS App Store

**Required in App Store Connect:**
- [ ] App name: "Doomscrolls"
- [ ] Subtitle: "Scroll with purpose"
- [ ] Description (4000 chars max)
- [ ] Keywords (100 chars)
- [ ] Privacy Policy URL: `https://your-domain.com/legal/privacy`
- [ ] App Category: Books
- [ ] Age Rating: 4+ (no objectionable content)
- [ ] App Icon: 1024x1024
- [ ] Screenshots: 6.7", 6.5", 5.5" iPhones + iPad Pro

**In-App Requirements:**
- [ ] Account deletion implemented and working
- [ ] Privacy Policy accessible
- [ ] Terms of Service accessible

**Screenshot Submission:**
- [ ] Screenshot showing delete account flow (for review notes)
- [ ] Demo account credentials for reviewer (if needed)

### 8.2 Google Play Store

**Required in Play Console:**
- [ ] App name: "Doomscrolls"
- [ ] Short description (80 chars)
- [ ] Full description (4000 chars)
- [ ] App Category: Books & Reference
- [ ] Content Rating: Everyone
- [ ] Privacy Policy URL
- [ ] App Icon: 512x512
- [ ] Feature Graphic: 1024x500
- [ ] Screenshots: Phone + 7" + 10" tablets

**Data Safety Form:**
- [ ] Data collected: Email, user activity
- [ ] Data shared: None
- [ ] Data encrypted in transit: Yes
- [ ] Users can request deletion: Yes
- [ ] Deletion URL provided

**In-App Requirements:**
- [ ] Account deletion implemented
- [ ] Privacy Policy link
- [ ] Terms of Service link

### 8.3 Chrome Web Store

**Required in Developer Dashboard:**
- [ ] Extension name: "Doomscrolls"
- [ ] Summary (132 chars)
- [ ] Description
- [ ] Category: Productivity
- [ ] Language: English
- [ ] Privacy Policy URL
- [ ] Icon: 128x128
- [ ] Screenshots: 1280x800 or 640x400

**Permission Justifications:**
- [ ] `storage`: "Store device ID and user preferences locally"
- [ ] Host permission: "Connect to Doomscrolls API to fetch passages"

**Single Purpose Description:**
Required statement explaining the extension's single purpose (avoiding rejection for multiple purposes).

---

## 9. Assets Required

### 9.1 Icons

| Platform | Size | Format | Notes |
|----------|------|--------|-------|
| iOS | 1024x1024 | PNG | App Store icon |
| iOS | 180x180 | PNG | @3x app icon |
| iOS | 120x120 | PNG | @2x app icon |
| iOS | 60x60 | PNG | @1x app icon |
| Android | 512x512 | PNG | Play Store icon |
| Android | 192x192 | PNG | xxxhdpi |
| Android | 144x144 | PNG | xxhdpi |
| Android | 96x96 | PNG | xhdpi |
| Android | 72x72 | PNG | hdpi |
| Android | 48x48 | PNG | mdpi |
| Android | Adaptive | XML | Foreground + background layers |
| Chrome | 128x128 | PNG | Store icon |
| Chrome | 48x48 | PNG | Toolbar |
| Chrome | 32x32 | PNG | Windows |
| Chrome | 16x16 | PNG | Favicon |

**Icon Design:**
- Simple text-based icon ("DS" or scroll imagery)
- Works on both light and dark backgrounds
- No text smaller than readable at 48px

### 9.2 Screenshots

**iOS:**
| Device | Size |
|--------|------|
| iPhone 6.7" | 1290x2796 |
| iPhone 6.5" | 1284x2778 |
| iPhone 5.5" | 1242x2208 |
| iPad Pro 12.9" | 2048x2732 |

**Android:**
| Device | Size |
|--------|------|
| Phone | 1080x1920 (min) |
| 7" Tablet | 1200x1920 |
| 10" Tablet | 1920x1200 |

**Chrome:**
- 1280x800 or 640x400
- At least 1, up to 5 screenshots

### 9.3 Store Descriptions

**Short Description (80 chars):**
```
Classical literature in an infinite scroll. Scroll with purpose, not chaos.
```

**Keywords (100 chars):**
```
literature,classics,reading,books,quotes,philosophy,stoicism,poetry,wisdom,scroll
```

**Full Description:**
See `/store-compliance/app-store-description.md`

---

## 10. Testing Checklist

### 10.1 Core Functionality

- [ ] Feed loads and scrolls infinitely
- [ ] Passage cards display correctly
- [ ] Like button toggles and updates count
- [ ] Bookmark button toggles
- [ ] Share opens native share sheet / copies to clipboard
- [ ] Category filtering works
- [ ] Author page loads from author name tap
- [ ] Work page loads from work title tap
- [ ] Search returns results

### 10.2 Authentication

- [ ] Signup creates account
- [ ] Login succeeds with valid credentials
- [ ] Login fails gracefully with invalid credentials
- [ ] Logout clears session
- [ ] Token refresh works automatically
- [ ] Anonymous browsing works without login

### 10.3 User Data

- [ ] Local likes persist across app restarts
- [ ] Local bookmarks persist
- [ ] Login syncs local data to server
- [ ] Subsequent interactions save to server
- [ ] Bookmarks page shows saved passages
- [ ] User stats are accurate

### 10.4 Compliance

- [ ] Privacy Policy link works
- [ ] Terms of Service link works
- [ ] Delete Account shows confirmation
- [ ] Delete Account actually deletes data
- [ ] After deletion, user is logged out
- [ ] After deletion, user can use app anonymously

### 10.5 Edge Cases

- [ ] Offline handling (graceful error)
- [ ] Empty states (no bookmarks, no likes)
- [ ] Long passage text wraps correctly
- [ ] Very short passages display correctly
- [ ] Special characters render properly
- [ ] Dark mode / light mode works

### 10.6 Performance

- [ ] Initial load under 3 seconds
- [ ] Scroll is smooth (60fps)
- [ ] No memory leaks during extended scrolling
- [ ] Images/avatars load efficiently

---

## Appendix A: API Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| UNAUTHORIZED | 401 | Missing or invalid token |
| FORBIDDEN | 403 | Insufficient permissions |
| NOT_FOUND | 404 | Resource not found |
| VALIDATION_ERROR | 400 | Invalid input |
| RATE_LIMITED | 429 | Too many requests |
| SERVER_ERROR | 500 | Internal error |

**Rate Limiting:**
- 1000 requests per day per device ID
- Resets at midnight UTC

---

## Appendix B: Quick Start Commands

**iOS:**
```bash
# Open in Xcode
open Doomscrolls.xcodeproj

# Run on simulator
xcodebuild -scheme Doomscrolls -destination 'platform=iOS Simulator,name=iPhone 15'
```

**Android:**
```bash
# Run debug build
./gradlew installDebug

# Build release APK
./gradlew assembleRelease
```

**Chrome Extension:**
```bash
# Load unpacked extension in Chrome
# 1. Go to chrome://extensions
# 2. Enable Developer mode
# 3. Click "Load unpacked"
# 4. Select the extension folder
```

---

*End of Native Apps Implementation Plan*
