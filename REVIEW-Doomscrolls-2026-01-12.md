# Doomscrolls Code Review (2026-01-12)

## 1. Executive Summary
- Admin endpoints are publicly accessible with no auth checks, allowing unauthenticated config changes and data exfiltration.
- Access tokens are persisted to localStorage, contradicting the documented in-memory-only intent and exposing tokens to XSS.
- Lists feature is wired to slug-based routes on the server but id-based routes on the client, causing list CRUD and item operations to 404.
- User likes/bookmarks + stats API responses don’t match client expectations, breaking sync and profile stats rendering.
- Search API response shape (`results` object + `mode`) doesn’t match the client’s expected flat `results` array + `method`, likely breaking search results.
- Personalized feed can throw when candidate queries return zero rows.

## 2. Critical Issues

### 2.1 Unauthenticated admin endpoints
- **Location:** `server/routes/admin.ts:7`
- **Issue:** Admin stats/config endpoints are exposed without any auth/role checks.
- **Impact:** Any unauthenticated caller can read dataset stats and change feed algorithm config (integrity + availability risk).
- **Recommendation:** Require auth middleware and enforce admin authorization (role/claim). Consider restricting by environment (e.g., only in dev).

### 2.2 Access token persisted in localStorage
- **Location:** `webapp/src/store/authStore.ts:25`
- **Issue:** `persist` stores `accessToken` to localStorage, despite the design doc stating access tokens are in memory only.
- **Impact:** XSS could steal access tokens; session fixation risks increase.
- **Recommendation:** Keep access tokens in memory only; persist user profile (or use a short-lived in-memory token and refresh via httpOnly cookie).

### 2.3 Lists API route mismatch (slug vs id + path names)
- **Location:** `server/routes/lists.ts:141`, `server/routes/lists.ts:202`, `server/routes/lists.ts:248`
- **Issue:** Server expects `/lists/:slug` and `/lists/:slug/chunks`, while client calls `/lists/:id` and `/lists/:id/passages`.
- **Impact:** List detail, update, delete, and add/remove passage calls will 404; list feature likely unusable.
- **Recommendation:** Standardize on either `slug` or `id` and align both server and client paths (including `/chunks` vs `/passages`).

### 2.4 Likes/bookmarks sync contract mismatch
- **Location:** `server/routes/user.ts:11`, `server/routes/user.ts:90`, `server/routes/user.ts:114`, `server/routes/user.ts:193` and `webapp/src/services/api.ts:137`
- **Issue:** Server returns `{ passages: [...] }` for GET likes/bookmarks and `{ synced, failed, total }` for sync; client expects `{ likes: [...] }` / `{ bookmarks: [...] }` and returns synced lists.
- **Impact:** `syncWithServer` will likely throw or silently fail, leaving likes/bookmarks out of sync and UI state inconsistent.
- **Recommendation:** Align response shapes; either return `likes/bookmarks` arrays from server or update client to consume `passages`.

### 2.5 Search API contract mismatch
- **Location:** `server/routes/search.ts:168`, `webapp/src/services/api.ts:303`, `webapp/src/pages/SearchPage.tsx:32`
- **Issue:** Server returns `{ results: { authors, works, passages }, mode }`, while client expects `{ results: SearchResult[], method }`.
- **Impact:** Search results won’t render (or will render empty), and `searchMethod` will be undefined.
- **Recommendation:** Normalize API to return a single array of `{ type, ... }` results and `method`, or update the client to flatten `results` and read `mode`.

## 3. Warnings

### 3.1 Personalized feed can throw on empty candidate set
- **Location:** `server/services/feed-algorithm.ts:1058`
- **Issue:** `Math.max(...candidates.map(...), 1)` throws if `candidates` is empty.
- **Impact:** Feed endpoint may return 500 for edge cases (e.g., category with zero matches + strict filters).
- **Recommendation:** Guard against empty candidates and fallback to `generateFeed` or return an empty page with `hasMore=false`.

### 3.2 Unauthenticated likes endpoint + weak rate limiting
- **Location:** `server/routes/passages.ts:32`, `server/middleware/rateLimit.ts:7`
- **Issue:** Anyone can call the like endpoint; rate limiting is in-memory and based on a client-supplied `X-Device-ID` header.
- **Impact:** Like counts can be inflated or depleted; rate limit is trivial to bypass by rotating device IDs.
- **Recommendation:** Require auth for likes (or signed device IDs) and back rate limit with Redis/IP throttling.

### 3.3 User stats naming mismatch
- **Location:** `server/routes/user.ts:269`, `webapp/src/types/index.ts:85`, `webapp/src/pages/ProfilePage.tsx:46`
- **Issue:** Server returns `passagesLiked`, `passagesBookmarked`, `authorsFollowed`, but client expects `likeCount`, `bookmarkCount`, `followingCount`, `listsCount`.
- **Impact:** Profile stats will display `undefined` or incorrect values.
- **Recommendation:** Align response keys or map the server response to the client type.

### 3.4 Reading progress field mismatch
- **Location:** `server/routes/user.ts:300`, `webapp/src/types/index.ts:105`
- **Issue:** Server returns `currentChunkIndex`, while client type expects `currentIndex`.
- **Impact:** Type safety is misleading and UI may break if consumers rely on `currentIndex`.
- **Recommendation:** Standardize naming across API responses and client types.

### 3.5 TypeScript checks failing in scripts
- **Location:** `scripts/generate-embeddings.ts`, `scripts/gutenberg/gutendex.ts`, `scripts/standardebooks/extract-text.ts`, `scripts/wikiquote/crawl-categories-v2.ts`
- **Issue:** `npx tsc --noEmit` reports missing types and `unknown` assignment issues in scripts.
- **Impact:** CI/type-checks will fail; scripts are unsafe to compile/run.
- **Recommendation:** Add missing type declarations or narrow types in scripts, or exclude scripts from the main TS build if intentional.

## 4. Suggestions
- Consider batching bookmark/like retrieval in the UI instead of per-id calls (e.g., use `/user/bookmarks` to hydrate the bookmarks page).
- Add explicit error codes in API responses (the docs describe `code` but many endpoints return only `error`).
- Replace `ORDER BY RANDOM()` on large tables with a more scalable sampling strategy or precomputed random buckets.
- Document the API response schema for `/search`, `/user/likes`, `/lists`, and keep it in sync with the client types.

## 5. Positive Observations
- Clear separation of routes, services, middleware, and db layers; code is easy to navigate.
- Refresh tokens are httpOnly and hashed before storage, which is a solid security baseline.
- Feed algorithm shows thoughtful diversity logic with configurable ratios and fallbacks.
- UI includes good loading/empty states across pages and uses consistent components.
- Centralized API client + auth refresh retry makes call sites simpler and consistent.
