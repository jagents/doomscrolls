# Doomscrolls Documentation v3

**Version:** 3.0 (Phase 2 + Compliance)
**Last Updated:** January 13, 2026

---

## Table of Contents

1. [Overview](#1-overview)
2. [User Guide](#2-user-guide)
3. [Feed Features](#3-feed-features)
4. [User Accounts](#4-user-accounts)
5. [Social Features](#5-social-features)
6. [Content Discovery](#6-content-discovery)
7. [Admin Dashboard](#7-admin-dashboard)
8. [Legal & Compliance](#8-legal--compliance)
9. [Technical Reference](#9-technical-reference)
10. [Glossary](#10-glossary)

---

## 1. Overview

### What is Doomscrolls?

Doomscrolls transforms the addictive "infinite scroll" experience of social media into something meaningful: an endless stream of humanity's greatest writings. Instead of scrolling through fleeting tweets and status updates, users encounter passages from classical literature, philosophy, poetry, and wisdom texts.

### Core Value Proposition

> "If you're going to scroll, scroll through wisdom."

### Key Features

| Feature | Description |
|---------|-------------|
| Infinite Feed | Endless stream of curated literary passages |
| Smart Diversity | Mix of content types, lengths, authors, and works |
| Personalization | Feed learns from your likes and bookmarks |
| User Accounts | Sync data across devices, follow authors |
| Reading Lists | Create and share custom collections |
| Work Reader | Read complete works passage-by-passage |
| Dark/Light Mode | Toggle between themes |

### Content Library

| Metric | Value |
|--------|-------|
| Total Passages | 10.3 million |
| Works | 17,291 |
| Authors | 7,664 |
| Curated Works (Featured) | 153 |
| Categories | 13 |

---

## 2. User Guide

### 2.1 Getting Started

1. **Open Doomscrolls** at `http://localhost:4800` (or your deployment URL)
2. **Start Scrolling** - passages load automatically as you scroll
3. **Create Account** (optional) - sync data and access more features

### 2.2 Main Feed

The feed presents a curated stream of passages in a Twitter-style layout.

#### Feed Layout
```
┌─────────────────────────────────────────────────────────────────┐
│  [Left Sidebar]    │    [Main Feed]       │  [Right Sidebar]    │
│  275px             │    max 600px         │  300px              │
│                    │                      │                     │
│  - Home            │  ┌────────────────┐  │  Discover Authors   │
│  - Explore         │  │ PassageCard    │  │  - Featured authors │
│  - Bookmarks       │  │ ...            │  │                     │
│  - Lists           │  └────────────────┘  │  Categories         │
│  - Profile         │  ┌────────────────┐  │  - Browse by topic  │
│  - Theme Toggle    │  │ PassageCard    │  │                     │
│  - Admin           │  │ ...            │  │  ─────────────────  │
│                    │  └────────────────┘  │  Footer: Legal links│
└─────────────────────────────────────────────────────────────────┘
```

#### Passage Card Anatomy
```
┌─────────────────────────────────────────────────────┐
│ [MA]  Marcus Aurelius · Meditations                 │
│       ─────────────────────────────────────────     │
│       The happiness of your life depends upon      │
│       the quality of your thoughts...              │
│       ─────────────────────────────────────────     │
│       [♡ 42]        [🔖]           [↗]             │
└─────────────────────────────────────────────────────┘
```

- **Avatar**: Circular with author initials
- **Author name**: Bold, clickable (opens author page)
- **Work title**: Secondary text, clickable (opens work page)
- **Passage text**: The literary content
- **Like button**: Heart icon with count
- **Bookmark button**: Save for later
- **Share button**: Share via native share or clipboard

### 2.3 Interactions

#### Liking Passages
- Click the heart icon to like
- Like count updates immediately
- Liked passages influence your personalized feed
- Works without account (stored locally)
- With account: synced across devices

#### Bookmarking Passages
- Click the bookmark icon to save
- Access bookmarks from sidebar menu
- Bookmarked passages influence personalization
- Works without account (stored locally)
- With account: synced across devices

#### Sharing Passages
- Click the share icon
- Uses native share API on mobile
- Falls back to clipboard on desktop
- Generates shareable link

### 2.4 Navigation

| Destination | How to Access |
|-------------|---------------|
| Home Feed | Click "Home" in sidebar or Doomscrolls logo |
| Explore | Click "Explore" in sidebar |
| Author Page | Click author name on any passage |
| Work Page | Click work title on any passage |
| Bookmarks | Click "Bookmarks" in sidebar |
| Lists | Click "Lists" in sidebar |
| Profile | Click "Profile" in sidebar (requires account) |
| Admin | Click "Admin" in sidebar |

### 2.5 Theme Toggle

- Click the sun/moon icon in the sidebar
- Toggles between Dark Mode (default) and Light Mode
- Preference saved to localStorage

---

## 3. Feed Features

### 3.1 Categories

Browse passages by category using the horizontal tabs above the feed.

| Category | Description | Icon |
|----------|-------------|------|
| For You | Personalized feed based on your activity | Sparkles |
| Philosophy | Wisdom from Plato, Aristotle, Nietzsche | Brain |
| Poetry | Verses from Shakespeare, Dickinson, Whitman | Feather |
| Fiction | Passages from Tolstoy, Austen, Dostoevsky | Book |
| Stoicism | Marcus Aurelius, Seneca, Epictetus | Mountain |
| Religion & Spirituality | Sacred texts and spiritual wisdom | Sun |
| Essays | Montaigne, Emerson, Thoreau | Pen |
| Drama | Shakespeare's plays and theatrical works | Theater |
| History | Chronicles of human civilization | Scroll |
| Russian Literature | The great Russian masters | Star |
| Ancient | Works from antiquity | Pillar |
| Medieval | Middle Ages literature | Castle |
| Modern | Contemporary classics | Building |
| Romanticism | Emotion and nature celebrated | Heart |

**How Categories Work:**
- Click a category tab to filter the feed
- Feed shows only passages from works in that category
- "For You" shows personalized content across all categories
- Categories are based on work classification, not individual passages

### 3.2 Content Diversity

The feed algorithm ensures variety in what you see.

#### Author Diversity
- **What it does**: Prevents the same author from appearing too frequently
- **How it works**: After seeing an author, they won't appear for the next N passages
- **Default setting**: 1 in 20 passages maximum
- **Configurable**: Yes, via Admin Dashboard (1-50)

#### Work Diversity
- **What it does**: Prevents the same work from appearing too frequently
- **How it works**: After seeing a work, it won't appear for the next N passages
- **Default setting**: 1 in 10 passages maximum
- **Configurable**: Yes, via Admin Dashboard (1-100)

### 3.3 Length Diversity

The feed mixes passages of different lengths for variety.

#### Length Buckets

| Bucket | Character Range | Default Target |
|--------|-----------------|----------------|
| Short | 10 - 150 chars | 30% of feed |
| Medium | 151 - 499 chars | 40% of feed |
| Long | 500 - 1000 chars | 30% of feed |

**How it works:**
- When enabled, each feed batch targets the configured ratios
- Short passages are quick reads (quotes, aphorisms)
- Medium passages are standard excerpts
- Long passages are immersive reads

**Configuration** (Admin Dashboard):
- Toggle: Enable/Disable Length Diversity
- Short Max Length: Upper bound for "short" (default: 150)
- Long Min Length: Lower bound for "long" (default: 500)
- Ratios: Adjustable sliders for each bucket (0-100%)

### 3.4 Content Type Diversity

The feed mixes different types of content.

#### Content Types

| Type | Database Values | Examples | Default Target |
|------|-----------------|----------|----------------|
| Prose | null, passage, section, chapter | Novel excerpts, essay paragraphs | 20% |
| Quote | quote, saying | Wisdom quotes, aphorisms | 45% |
| Poetry | verse, poem, verse_group | Poems, stanzas, verses | 30% |
| Speech | speech | Famous speeches, orations | 5% |

**How it works:**
- Algorithm queries a large random sample (300 passages)
- Categorizes each passage by type
- Selects from each bucket to match target ratios
- Prioritizes rare types (speech, poetry) over prose
- Fills shortfalls with prose (most abundant)
- Shuffles final result

**Configuration** (Admin Dashboard):
- Toggle: Enable/Disable Content Type Mix
- Ratios: Adjustable sliders for each type (0-100%)
- Visual bar shows distribution

**Notes:**
- Curated works have limited type diversity (~99% prose)
- Full corpus (logged-in users) has more variety
- Targets are approximate due to content availability

### 3.5 Personalization

The feed learns from your behavior to show relevant content.

#### How Personalization Works

1. **Signal Collection**: App tracks your interactions
2. **Scoring**: Each candidate passage gets a score based on signals
3. **Selection**: Higher-scored passages appear more often
4. **Exploration**: Random factor ensures new content discovery

#### Signal Types

**Account-Required Signals** (strongest):
| Signal | Boost | Description |
|--------|-------|-------------|
| Followed Author | 3.0x | Authors you explicitly follow |

**Device-Based Signals** (work without account):
| Signal | Boost | Description |
|--------|-------|-------------|
| Liked Author | 1.5x | Authors whose passages you've liked |
| Liked Category | 1.3x | Categories you engage with |
| Bookmarked Work | 1.2x | Works you've bookmarked passages from |
| Bookmarked Author | 1.15x | Authors whose passages you've bookmarked |

**Derived Signals**:
| Signal | Boost | Description |
|--------|-------|-------------|
| Similar Era | 1.1x | Time periods matching your preferences |
| Popularity | 0.3x | Like count (normalized) |

#### Personalization Requirements
- **Minimum signals**: 3 likes or bookmarks before activating
- **Exploration factor**: 30% random content for discovery
- **Full corpus access**: Logged-in users can access all 10.3M passages

#### Configuration (Admin Dashboard)
- Master toggle: Enable/Disable Personalization
- Min Signals Required: Threshold to activate (default: 3)
- Full Corpus for Logged-in: Toggle access to all content
- Signal weight sliders for each boost factor
- Exploration vs Exploitation balance

---

## 4. User Accounts

### 4.1 Registration

**To create an account:**
1. Click "Sign Up" in the header or sidebar
2. Enter email address
3. Enter password (min 8 characters)
4. Optionally enter display name
5. Click "Create Account"

**Benefits of an account:**
- Sync likes and bookmarks across devices
- Follow authors
- Create reading lists
- Track reading progress
- Access full corpus (10.3M passages)
- Personalized "For You" feed

### 4.2 Login/Logout

**To log in:**
1. Click "Log In" in the header
2. Enter email and password
3. Click "Log In"

**To log out:**
1. Click your profile in the sidebar
2. Click "Log Out"

**Token Management:**
- Access tokens expire after 15 minutes
- Refresh tokens last 7 days
- Automatic token refresh on API calls

### 4.3 Profile Settings

**Access profile:**
1. Click "Profile" in sidebar (when logged in)

**Available settings:**
- Display Name: Your public name
- Change Password: Update your password

**User Stats displayed:**
- Total likes
- Total bookmarks
- Authors following
- Lists created
- Works in progress
- Works completed

### 4.4 Account Deletion

**To delete your account:**
1. Go to Profile page
2. Scroll to "Danger Zone" section at bottom
3. Click "Delete Account"
4. Confirm in the modal dialog
5. Account and all data deleted immediately

**Data deleted includes:**
- User account record
- All likes
- All bookmarks
- All reading lists
- Reading progress
- Author follows

**Important:** This action cannot be undone.

### 4.5 Data Sync

When you create an account, your local data syncs automatically:
- Existing likes → synced to database
- Existing bookmarks → synced to database
- New interactions → saved to both local and server

---

## 5. Social Features

### 5.1 Following Authors

**To follow an author:**
1. Navigate to author page (click author name)
2. Click "Follow" button
3. Button changes to "Following"

**To unfollow:**
1. Navigate to author page
2. Click "Following" button
3. Confirms unfollow

**Following benefits:**
- Passages from followed authors get 3x boost in feed
- Access "Following" feed tab
- Follower count displayed on author page

### 5.2 Following Feed

**Access the Following feed:**
1. Log in to your account
2. Click "Following" tab in feed header

**How it works:**
- Shows only passages from authors you follow
- If no follows, suggests popular authors
- Same diversity rules apply (author, work, length)

### 5.3 Reading Lists

**Creating a list:**
1. Click "Lists" in sidebar
2. Click "Create List"
3. Enter name and description
4. Choose public or private
5. Click "Create"

**Adding passages to a list:**
1. On any passage, click the menu (...)
2. Select "Add to List"
3. Choose a list
4. Passage is added

**Managing lists:**
- View all your lists in Lists page
- Edit name/description
- Delete lists
- Remove passages
- Make public/private

**Curated Lists:**
- Admin-created featured lists
- Available to all users
- Cannot be modified by users

**Note:** Lists can be accessed by either ID (UUID) or slug in URLs.

### 5.4 Sharing Passages

**Share options:**
1. Click share button on passage
2. Mobile: Native share sheet appears
3. Desktop: Link copied to clipboard

**Share format:**
- Direct link to passage page
- Preview shows passage text and author

---

## 6. Content Discovery

### 6.1 Author Pages

**Access**: Click any author name

**Page contents:**
- Author name and avatar
- Life dates (birth/death years)
- Era (Ancient, Medieval, Modern, etc.)
- Nationality
- Primary genre
- Follower count
- Follow/Unfollow button
- List of works
- Random passages from author

### 6.2 Work Pages

**Access**: Click any work title

**Page contents:**
- Work title
- Author (clickable)
- Year published
- Type (novel, poem, play, etc.)
- Genre
- Passage count
- "Read" button for sequential reading
- Paginated list of passages

### 6.3 Work Reader

**Sequential reading experience:**
1. Navigate to work page
2. Click "Read" or "Continue Reading"
3. Passages shown one at a time
4. Use arrows or swipe to navigate
5. Progress saved automatically

**Progress tracking:**
- Current position saved
- Percentage complete shown
- Resume where you left off
- Mark as completed when finished

### 6.4 Similar Passages

**Finding similar content:**
1. Click on a passage to open detail view
2. Scroll down to "Similar Passages"
3. Shows up to 10 related passages

**How similarity works:**
- Uses embedding vectors when available
- Falls back to same author/work
- Considers content similarity, not just metadata

### 6.5 Search

**Using search:**
1. Click search icon in header
2. Enter search query
3. Results show passages, authors, and works

**Search capabilities:**
- Full-text search of passage content
- Author name search
- Work title search
- Hybrid search (keyword + semantic when embeddings available)

### 6.6 Discover Panel

**Right sidebar features:**

**Discover Authors:**
- 5 randomly selected featured authors
- Click to explore their works
- Refreshes periodically

**Popular Passages:**
- Most liked passages
- Updated in real-time

**Categories:**
- Quick access to all categories
- Work counts displayed

**Footer:**
- Legal links (Privacy Policy, Terms of Service)
- Copyright notice
- Format: "Scroll with purpose. Privacy · Terms © 2026 DDP"

---

## 7. Admin Dashboard

**Access**: `http://localhost:4800/admin`

### 7.1 Dashboard Overview

The admin dashboard provides monitoring and configuration across four tabs:
- Dataset: Corpus statistics
- Feed Stats: Engagement metrics
- Users: Phase 2 user data
- Algorithm: Configuration controls

### 7.2 Dataset Tab

**Corpus Statistics:**
| Metric | Description |
|--------|-------------|
| Total Passages | Number of chunks in database (approximate*) |
| Works | Number of literary works |
| Authors | Number of authors |
| Curated Works | Works selected for main feed |

*Note: Passage count uses PostgreSQL's `pg_class.reltuples` for performance (exact counts on 10M+ rows would take 30+ seconds).

**Category Breakdown:**
- Lists all 13 categories
- Shows work count per category
- Category icons displayed

### 7.3 Feed Stats Tab

**Engagement Metrics:**
| Metric | Description |
|--------|-------------|
| Total Likes | Sum of all passage likes |
| Total Views | Sum of all passage views |

**Top Passages:**
- Top 10 most liked passages
- Shows text preview, author, work
- Like count displayed

### 7.4 Users Tab

**User Statistics:**
| Metric | Description |
|--------|-------------|
| Total Users | Registered accounts |
| Active This Week | Users active in last 7 days |
| Users with Likes | Users who have liked passages |
| Users Following | Users following at least one author |

**Embeddings Progress:**
- Processing progress bar
- Passages with embeddings / total
- Percentage complete

**Lists Statistics:**
| Metric | Description |
|--------|-------------|
| Total Lists | All user-created lists |
| Curated | Admin-created featured lists |
| Passages Saved | Total passages across all lists |

**Top Followed Authors:**
- Authors with most followers
- Follower count displayed

### 7.5 Algorithm Tab

All feed algorithm settings with real-time controls.

#### Content Diversity Section

| Setting | Range | Default | Description |
|---------|-------|---------|-------------|
| Author Diversity | 1-50 | 20 | Max 1 appearance per N passages |
| Work Diversity | 1-100 | 10 | Max 1 appearance per N passages |
| Min Length | 1-500 | 10 | Minimum passage characters |
| Max Length | 100-5000 | 1000 | Maximum passage characters |

#### Length Diversity Section

| Setting | Range | Default | Description |
|---------|-------|---------|-------------|
| Enable Toggle | on/off | on | Master switch for length diversity |
| Short Max | 10-500 | 150 | Upper bound for "short" passages |
| Long Min | 200-2000 | 500 | Lower bound for "long" passages |
| Short % | 0-100 | 30 | Target percentage short passages |
| Medium % | 0-100 | 40 | Target percentage medium passages |
| Long % | 0-100 | 30 | Target percentage long passages |

**Visual indicator:**
- Color-coded bar showing distribution
- Green = Short, Yellow = Medium, Blue = Long
- Total percentage shown (should equal 100%)

#### Content Type Mix Section

| Setting | Range | Default | Description |
|---------|-------|---------|-------------|
| Enable Toggle | on/off | on | Master switch for type diversity |
| Prose % | 0-100 | 20 | Novels, passages, chapters |
| Quote % | 0-100 | 45 | Quotes, sayings, aphorisms |
| Poetry % | 0-100 | 30 | Verses, poems, stanzas |
| Speech % | 0-100 | 5 | Famous speeches, orations |

**Visual indicator:**
- Color-coded bar showing distribution
- Indigo = Prose, Amber = Quote, Pink = Poetry, Emerald = Speech
- Total percentage shown

#### Personalization Section

**Master Settings:**
| Setting | Range | Default | Description |
|---------|-------|---------|-------------|
| Enable Toggle | on/off | on | Master switch for personalization |
| Min Signals | 0-50 | 3 | Likes/bookmarks before activating |
| Full Corpus | on/off | on | All 10.3M passages for logged-in |

**Signal Weights (Account-Required):**
| Signal | Range | Default | Description |
|--------|-------|---------|-------------|
| Followed Author | 0-10x | 3.0x | Boost for followed authors |

**Signal Weights (Device-Based):**
| Signal | Range | Default | Description |
|--------|-------|---------|-------------|
| Liked Author | 0-5x | 1.5x | Authors you've liked |
| Liked Category | 0-5x | 1.3x | Categories you engage with |
| Bookmarked Work | 0-5x | 1.2x | Works you've bookmarked |
| Bookmarked Author | 0-5x | 1.15x | Authors you've bookmarked |

**Derived Signals:**
| Signal | Range | Default | Description |
|--------|-------|---------|-------------|
| Similar Era | 0-5x | 1.1x | Matching time periods |
| Popularity | 0-2x | 0.3x | Based on like count |

#### Algorithm Tuning Section

| Setting | Range | Default | Description |
|---------|-------|---------|-------------|
| Exploration | 0-100% | 30% | Random discovery weight |
| Exploitation | 0-100% | 70% | Personalized content weight |
| Recency Penalty | 0-100% | 50% | Penalty for recent content |

**Visual indicator:**
- Bar showing Exploration (blue) vs Exploitation (accent color)
- Percentages displayed

#### Embedding Similarity Section

| Setting | Range | Default | Description |
|---------|-------|---------|-------------|
| Enable Toggle | on/off | on | Use embedding similarity |
| Similarity Weight | 0-100% | 50% | Weight in scoring |
| Min Likes | 1-50 | 5 | Likes for taste vector |
| Refresh Hours | 0.5-168 | 1 | Recompute interval |

### 7.6 Saving Configuration

- Changes are tracked (button shows "Save Changes" when modified)
- Click "Save Changes" to persist to database
- Configuration cached in server memory
- Applies immediately to new feed requests
- Page shows "No Changes" when config matches saved version

---

## 8. Legal & Compliance

### 8.1 Overview

Doomscrolls implements app store compliance features required for iOS App Store, Google Play Store, and Chrome Web Store submission.

### 8.2 Legal Documents

**Privacy Policy:**
- URL: `/legal/privacy`
- Describes data collection, usage, and retention
- Required for all app stores

**Terms of Service:**
- URL: `/legal/terms`
- Defines acceptable use and user responsibilities
- Required for all app stores

**Footer Display:**
- Located in right sidebar
- Format: "Scroll with purpose. Privacy · Terms © 2026 DDP"
- Links open in new browser tab

### 8.3 Account Deletion

Required by Apple since 2022 for any app with user accounts.

**In-App Deletion:**
- Located in Profile page under "Danger Zone"
- Shows confirmation modal listing all data to be deleted
- Warns that action cannot be undone
- Executes via `DELETE /api/auth/me`

**Data Deleted:**
- User account
- All likes
- All bookmarks
- All reading lists (and contents)
- Reading progress
- Author follows
- Refresh tokens

### 8.4 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/legal/privacy` | GET | Privacy Policy HTML |
| `/legal/terms` | GET | Terms of Service HTML |
| `/api/auth/me` | DELETE | Delete user account (auth required) |

### 8.5 Native App Implementation

For iOS, Android, and Chrome extension implementations, see:
- `/store-compliance/AuditDoomscrollsPlan.md` - Implementation guide
- `/store-compliance/IMPLEMENTATION_NOTES.md` - Code patterns

**Key Requirements by Platform:**

| Platform | Legal Links | Account Deletion | Icon Size |
|----------|-------------|------------------|-----------|
| Web | Footer (done) | Profile page (done) | favicon |
| iOS | Settings/About | In-app required (Apple policy) | 1024x1024 |
| Android | Settings/About | In-app + web URL (Google policy) | 512x512 |
| Chrome | Popup footer | Link to web app | 128x128 |

---

## 9. Technical Reference

### 9.1 API Base URL

```
http://localhost:4800/api
```

### 9.2 Authentication

**Headers:**
```
Authorization: Bearer <access_token>
X-Device-ID: <uuid>
Content-Type: application/json
```

**Token flow:**
1. Login → receive access token + refresh token (cookie)
2. Access token expires in 15 minutes
3. Refresh endpoint returns new access token
4. Refresh token expires in 7 days

### 9.3 Rate Limiting

- 1000 requests per day per device ID
- Resets at midnight UTC
- Returns 429 when exceeded

### 9.4 Pagination

**Cursor-based pagination:**
```
GET /api/feed?cursor=<base64>&limit=20
```

Response:
```json
{
  "passages": [...],
  "nextCursor": "<base64>",
  "hasMore": true
}
```

### 9.5 Error Responses

```json
{
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

Common codes:
- `UNAUTHORIZED` - Invalid or missing token
- `NOT_FOUND` - Resource not found
- `RATE_LIMITED` - Too many requests
- `VALIDATION_ERROR` - Invalid input

---

## 10. Glossary

| Term | Definition |
|------|------------|
| Passage | A text excerpt from a work (10-1000 characters) |
| Chunk | Database term for a passage |
| Work | A book, poem, play, or other literary work |
| Curated Works | Hand-selected works included in featured feed |
| Feed | The infinite scroll stream of passages |
| Cursor | Pagination token encoding position + diversity state |
| Diversity | Algorithm constraint preventing repetition |
| Base Algorithm | Global feed settings that apply to all users |
| Personalization | User-specific feed adjustments based on behavior |
| Signal | User action that influences personalization |
| Boost | Multiplier applied to passage score |
| Exploration | Random content for discovery |
| Exploitation | Personalized content based on preferences |
| Taste Vector | Average embedding of user's liked passages |
| Embedding | Vector representation of passage content |
| Compliance | App store requirements (privacy, terms, deletion) |

---

*Document maintained by the Doomscrolls development team.*
