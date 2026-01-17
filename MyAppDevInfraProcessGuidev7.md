# My App Development Infrastructure & Process Guide v7

_Last updated: January 2026_

> **Purpose**: A comprehensive, all-inclusive guide for building multi-channel apps — from initial idea to App Store/Play Store/Chrome Web Store submission. Covers my complete workflow including planning, server-side development, iOS/Android/Chrome development, infrastructure, and deployment. Written for myself, team members, or an LLM to help launch new projects.
>
> **What's New in v7**: Added complete **Cross-App Middleware for Suite Monetization** — centralized entitlement management, device identity, code redemption, and analytics tracking across multiple apps in a suite. Uses Scout App Studio (6 apps) as reference implementation. This pattern enables consistent monetization, email capture, and premium upgrade flows across an entire app portfolio.
>
> **What's New in v6**: Added Scout App Studio (scoutdev user, 6 apps on ports 4400-4406), updated droplet specs (4 vCPU / 8GB RAM)
>
> **What's New in v5**: Added complete **ExecFunc Design System** (Phthalo Purple theme, typography, component patterns), **Collapsible Sections Pattern** for cross-platform expandable UI, **Input Controls Pattern** (dropdowns, checkboxes, options passing), **Cross-Platform UI Consistency Practices** (iOS as source of truth), **Platform-Specific Gotchas & Lessons Learned**, and updated all checklists with styling items. Based on comprehensive learnings from styling "Read Between the Lines" across all 4 platforms.
>
> **What's New in v4**: Added complete Monetization & Entitlements section covering rate limiting implementation, device identity patterns (UUID), email capture flows, IAP integration (StoreKit 2 / Google Billing), the "Web/Chrome as Showroom, Mobile as Revenue" strategy, and data gating patterns for premium features.
>
> **What's New in v3**: Added AI pipeline patterns (multi-pass processing, content moderation), cross-platform JSON serialization reference, UI state management patterns (Kotlin sealed interface, Swift actor pattern), standard entity color palette, and test input library approach. Based on learnings from "Read Between the Lines" MVP completion.
>
> **What's New in v2**: Added complete Chrome Extension development, Android app development, multi-channel workflow patterns, Claude Code handoff strategies, GitHub multi-machine workflows, and portfolio structure learnings from building "Read Between the Lines" across all platforms.

---

# TABLE OF CONTENTS

1. [PART ONE: MAKING A NEW APP](#part-one-making-a-new-app)
   - The Complete Process Overview
   - Multi-Channel Development Model
   - Phase 1: Planning & Architecture
   - Phase 2: Server Infrastructure Setup
   - Phase 3: Backend Development
   - Phase 4: Web Client Development
   - Phase 5: iOS Mobile App Development
   - Phase 6: Chrome Extension Development
   - Phase 7: Android Mobile App Development
   - Phase 8: Testing & QA
   - Phase 9: Deployment & Launch

2. [PART TWO: iOS DEVELOPMENT DEEP DIVE](#part-two-ios-development-deep-dive)
   - Development Environment Setup
   - How Claude Code + Xcode Work Together
   - Project Structure
   - Key Implementation Details
   - Share Extension Development

3. [PART THREE: CHROME EXTENSION DEEP DIVE](#part-three-chrome-extension-deep-dive)
   - Development Environment Setup
   - Manifest V3 Configuration
   - Service Worker & Messaging
   - Sidebar Panel Development

4. [PART FOUR: ANDROID DEVELOPMENT DEEP DIVE](#part-four-android-development-deep-dive)
   - Development Environment Setup
   - How Claude Code + Android Studio Work Together
   - Key Implementation Details
   - Share Intent Integration

5. [PART FIVE: INFRASTRUCTURE REFERENCE](#part-five-infrastructure-reference)
   - Cloud Provider (DigitalOcean)
   - Database (Neon PostgreSQL)
   - Installed Runtimes & Tools
   - Port Reservations
   - User Accounts

6. [PART SIX: OPERATIONAL REFERENCE](#part-six-operational-reference)
   - Termius & Port Forwarding
   - pm2 Process Management
   - Environment Variables
   - Useful Commands
   - Troubleshooting

7. [PART SEVEN: CLAUDE CODE PATTERNS](#part-seven-claude-code-patterns)
   - Planning Documents
   - CLAUDE.md Configuration
   - Multi-Machine Handoff

8. [PART EIGHT: GITHUB WORKFLOWS](#part-eight-github-workflows)
   - Multi-Machine Git Flow
   - Common Commands
   - Avoiding Conflicts

9. [PART NINE: MULTI-APP PORTFOLIO STRUCTURE](#part-nine-multi-app-portfolio-structure)
   - ExecFunc Portfolio Strategy
   - Shared Infrastructure
   - New App Setup (Within Category)

10. [PART TEN: AI/LLM PROCESSING PATTERNS](#part-ten-aillm-processing-patterns)
    - Multi-Pass Pipeline Architecture
    - Content Moderation Pattern
    - Structured Output Extraction
    - Error Handling for AI Responses

11. [PART ELEVEN: CROSS-PLATFORM PATTERNS](#part-eleven-cross-platform-patterns)
    - JSON Serialization Reference
    - UI State Management Patterns
    - Standard Color Palettes
    - Entry Point Patterns (Share/Intent/Context Menu)

12. [PART TWELVE: TESTING PATTERNS](#part-twelve-testing-patterns)
    - Test Input Library Approach
    - Edge Case Categories
    - Platform-Specific Testing

13. [PART THIRTEEN: MONETIZATION & ENTITLEMENTS](#part-thirteen-monetization--entitlements)
    - The Philosophy: "Paramedic First"
    - Channel Strategy: "Web/Chrome as Showroom, Mobile as Revenue"
    - Rate Limiting Implementation
    - Device Identity Patterns
    - Email Capture Flows
    - IAP Integration (iOS & Android)
    - Data Gating Patterns

14. [PART FOURTEEN: EXECFUNC DESIGN SYSTEM (NEW v5)](#part-fourteen-execfunc-design-system-new-v5)
    - Phthalo Purple Theme
    - Typography Standards
    - Component Patterns
    - Platform-Specific Implementation

15. [PART FIFTEEN: COLLAPSIBLE SECTIONS PATTERN (NEW v5)](#part-fifteen-collapsible-sections-pattern-new-v5)
    - Design Principles
    - Arrow Direction Convention
    - Default Expansion States
    - Platform Implementations

16. [PART SIXTEEN: INPUT CONTROLS PATTERN (NEW v5)](#part-sixteen-input-controls-pattern-new-v5)
    - Dropdowns & Selection
    - Checkboxes & Toggles
    - Options Passing Through Stack

17. [PART SEVENTEEN: CROSS-PLATFORM UI CONSISTENCY (NEW v5)](#part-seventeen-cross-platform-ui-consistency-new-v5)
    - iOS as Source of Truth
    - Visual Parity Checklist
    - Common Divergence Points

18. [PART EIGHTEEN: PLATFORM-SPECIFIC GOTCHAS (NEW v5)](#part-eighteen-platform-specific-gotchas-new-v5)
    - Android Gotchas
    - Chrome Extension Gotchas
    - iOS Gotchas
    - Cross-Platform Lessons Learned

19. [PART NINETEEN: CROSS-APP MIDDLEWARE FOR SUITE MONETIZATION (NEW v7)](#part-nineteen-cross-app-middleware-for-suite-monetization-new-v7)
    - The Problem It Solves
    - Architecture Overview
    - Middleware Service Implementation
    - App Backend Integration
    - Client-Side Implementation
    - Tier Configuration Patterns
    - Code Redemption System
    - Analytics Event Tracking
    - Reference Implementation: Scout App Studio

20. [APPENDIX: TEMPLATES & CHECKLISTS](#appendix-templates--checklists)
    - Quick Reference Commands
    - Complete New App Checklist
    - Monetization Checklist
    - Design System Checklist (NEW v5)
    - Middleware Integration Checklist (NEW v7)

---

# PART ONE: MAKING A NEW APP

This is the complete process for taking an idea from concept to shipped product across multiple platforms. Follow these phases in order.

---

## The Complete Process Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                     MULTI-CHANNEL APP DEVELOPMENT LIFECYCLE                      │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐                      │
│  │ PLANNING │ → │  INFRA   │ → │ BACKEND  │ → │   WEB    │                      │
│  │          │   │  SETUP   │   │   DEV    │   │  CLIENT  │                      │
│  └──────────┘   └──────────┘   └──────────┘   └────┬─────┘                      │
│       │                                             │                            │
│       │                                             │ push to GitHub             │
│       │                                             ▼                            │
│       │              ┌──────────────────────────────────────────────┐            │
│       │              │              MAC DESKTOP                      │            │
│       │              │  ┌─────────┐  ┌─────────┐  ┌─────────┐       │            │
│       └─────────────►│  │   iOS   │  │ Chrome  │  │ Android │       │            │
│                      │  │   App   │  │Extension│  │   App   │       │            │
│                      │  └────┬────┘  └────┬────┘  └────┬────┘       │            │
│                      └───────┼────────────┼────────────┼─────────────┘            │
│                              ▼            ▼            ▼                          │
│                      ┌──────────┐  ┌──────────┐  ┌──────────┐                    │
│                      │App Store │  │Chrome    │  │Play Store│                    │
│                      │  Submit  │  │Web Store │  │  Submit  │                    │
│                      └──────────┘  └──────────┘  └──────────┘                    │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### My Typical Development Pattern

1. **Plan**: Use ChatGPT Pro / Gemini Pro / Claude / Grok to think through architecture, debate approaches, create PRD
2. **Execution Plan**: Ask **Claude Code CLI** to create a detailed execution plan
3. **Review**: Read through the plan, adjust as needed
4. **Execute Backend**: Let Claude Code implement backend + web on server
5. **Push to GitHub**: Commit and push server-side work
6. **Pull to Mac**: Clone/pull repo to Mac desktop
7. **Execute Clients**: Build iOS/Android/Chrome with Claude Code on Mac
8. **Style All Platforms**: Apply ExecFunc Design System to each client (NEW v5)
9. **Iterate**: Test via port-forwarded localhost URLs
10. **Ship**: Deploy backend, submit apps to stores

### Tools I Use

| Tool | Purpose | Machine |
|------|---------|---------|
| **Termius** | SSH, SFTP, port forwarding to server | Both |
| **Cursor** | IDE (when editing locally on Mac) | Mac |
| **Claude Code CLI** | Agentic coding | Both |
| **Xcode** | iOS app development | Mac only |
| **Android Studio** | Android app development | Mac only |
| **VS Code** | Chrome Extension development | Mac |
| **GitHub** | Version control, code hosting | Both |

---

## Multi-Channel Development Model

### Where Each Component is Developed

| Component | Machine | IDE/Tool | Claude Code |
|-----------|---------|----------|-------------|
| Backend API | Server | Claude Code CLI | Yes |
| Web App | Server | Claude Code CLI | Yes |
| iOS App | Mac Desktop | Xcode | Yes (separate session) |
| Chrome Extension | Mac Desktop | VS Code/Cursor | Yes (separate session) |
| Android App | Mac Desktop | Android Studio | Yes (separate session) |

### Development Sequence (Recommended Order)

1. **Backend API** (Server) — Core business logic, API endpoints
2. **Web App** (Server) — Reference implementation, full feature testing
3. **iOS App** (Mac) — Native SwiftUI, Share Extension
4. **Chrome Extension** (Mac) — Manifest V3, Sidebar panel
5. **Android App** (Mac) — Kotlin/Compose, Share Intent

**Why this order?**
- API must be stable before building clients
- Web app is fastest to iterate, catches API issues
- iOS is the "source of truth" for visual design
- Chrome uses web skills, relatively quick
- Android last because it's newest platform for us

### API-First Development

**Key Principle**: Build and stabilize the API first, then all clients use the same contract.

```json
// Example: POST /v1/analyze - same for all clients
{
  "text": "message to analyze",
  "relationship_context": "friend",
  "reply_style": "warm",
  "parent_mode": false,
  "source": "web | ios_share | android_share | chrome_extension"
}
```

---

## Phase 1: Planning & Architecture

### 1.1 Define the Product

**Core Questions:**
- What problem does this solve?
- Who is the user?
- What is the "moment" this app helps with?
- What is the minimum viable feature set?

**Technical Questions:**
- Does this need a backend API?
- Does this need a database?
- Does this need AI/LLM capabilities?
- Which platforms? (Web, iOS, Android, Chrome Extension)

**Monetization Questions:**
- Is this AI-heavy (high per-use cost) or deterministic (zero cost)?
- What's the free tier? How many uses/day?
- Subscription or one-time purchase?

### 1.2 Create Planning Documents

| Document | Purpose |
|----------|---------|
| **PRD** | What are we building, for whom, why |
| **Technical Architecture** | How components connect, data flow |
| **API Schema** | Endpoints, request/response formats |
| **Execution Plan** | Step-by-step implementation order |
| **Monetization Plan** | Pricing, tiers, entitlements |

### 1.3 Decide Project Organization

**Pattern A: New Category User** (starting a new category of related apps)
- Creates new Linux user (e.g., `efuncdev` for Executive Function apps)
- Creates category folder (e.g., `/aiprojects/execfunc/`)

**Pattern B: Standalone Project**
- Creates project-specific user (e.g., `scholardev`)

**Pattern C: New Project Under Existing Category** (adding to existing category)
- Reuses existing user and tools
- Just create new subfolder and git repo
- Much faster setup!

### 1.4 Reserve Your Ports

Check the Port Reservations table in Part Five and pick from available ranges:
- 3200-3299 (agents/microservices)
- 4400-4499 (main apps)
- 5400-5499 (dashboards/UIs)

---

## Phase 2: Server Infrastructure Setup

### 2.1 Pattern A: Full Setup (New Category)

#### Step 1: Create GitHub Repository
1. Go to GitHub → Your repositories (github.com/jagents)
2. Click "New repository"
3. Configure: Private, Initialize with README

#### Step 2: Create Linux User and Folders (as aiadmin)

```bash
ssh aiadmin@157.245.191.245

# Create category-based user
sudo adduser {category}dev
sudo usermod -aG sudo {category}dev

# Create category folder with project subfolder
sudo mkdir -p /aiprojects/{category}/{projectname}
sudo chown -R {category}dev:{category}dev /aiprojects/{category}
```

#### Step 3: Set Up SSH Key Access (CRITICAL)

**Important**: Password auth is disabled on the server. Copy the authorized SSH key:

```bash
sudo mkdir -p /home/{category}dev/.ssh
sudo cp /home/scholardev/.ssh/authorized_keys /home/{category}dev/.ssh/
sudo chown -R {category}dev:{category}dev /home/{category}dev/.ssh
sudo chmod 700 /home/{category}dev/.ssh
sudo chmod 600 /home/{category}dev/.ssh/authorized_keys
```

#### Step 4: Install Development Tools (as new user)

```bash
# Install nvm + node
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
source ~/.bashrc
nvm install node

# Install bun
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc

# Install pm2 and claude-code globally
npm install -g pm2 @anthropic-ai/claude-code
```

#### Step 5: Configure SSH Key for GitHub

```bash
ssh-keygen -t ed25519 -C "{category}dev@droplet"
cat ~/.ssh/id_ed25519.pub
# Add to GitHub: Settings → SSH and GPG keys → New SSH key
ssh -T git@github.com  # Test
```

### 2.2 Pattern B: Quick Setup (New Project in Existing Category)

```bash
# As the existing category user (e.g., efuncdev)
mkdir -p /aiprojects/{category}/{newproject}
cd /aiprojects/{category}/{newproject}
git clone git@github.com:jagents/{newproject}.git .
tmux new -s {newproject}
claude
```

---

## Phase 3: Backend Development

### 3.1 Standard Project Structure

```
{projectname}/
├── backend/
│   ├── src/
│   │   ├── index.ts           # Entry point, serves static
│   │   ├── config.ts          # Environment config
│   │   ├── routes/            # API route handlers
│   │   ├── services/          # Business logic
│   │   ├── middleware/        # Rate limiting, auth, etc.
│   │   └── schemas/           # Zod validation schemas
│   ├── tests/
│   ├── package.json
│   └── ecosystem.config.cjs   # pm2 configuration
├── web/                       # Static web client
├── prompts/                   # LLM prompts (if using AI)
├── ios/                       # iOS app (developed on Mac)
├── android/                   # Android app (developed on Mac)
├── chrome_extension/          # Chrome extension (developed on Mac)
├── docs/                      # Documentation
├── CLAUDE.md                  # Claude Code instructions
└── .env                       # Environment variables (DO NOT COMMIT)
```

### 3.2 Create Essential Files

**backend/ecosystem.config.cjs:**
```javascript
module.exports = {
  apps: [{
    name: '{projectname}-api',
    script: 'bun',
    args: 'run src/index.ts',
    cwd: '/aiprojects/{category}/{projectname}/backend',
    env: { NODE_ENV: 'production', PORT: {port} },
  }],
};
```

### 3.3 Process Management

```bash
pm2 start backend/ecosystem.config.cjs
pm2 logs {projectname}-api --lines 100
pm2 restart {projectname}-api
pm2 save
```

---

## Phase 4: Web Client Development

### 4.1 URL Parameters for Cross-App Integration

```javascript
// In app.js - handle ?text= parameter
(function handleUrlParams() {
  const params = new URLSearchParams(window.location.search);
  const text = params.get('text');
  if (text) {
    document.getElementById('message-input').value = decodeURIComponent(text);
    window.history.replaceState({}, '', '/');
    setTimeout(() => analyzeMessage(text), 100);
  }
})();
```

This allows Chrome Extension's "Reanalyze in Browser Tab" feature to work.

---

## Phase 5: iOS Mobile App Development

### 5.1 The Development Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         YOUR MAC                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐          │
│  │   Xcode     │    │ Claude Code │    │  Termius    │          │
│  │   (IDE)     │    │   (local)   │    │ (port fwd)  │          │
│  └──────┬──────┘    └─────────────┘    └──────┬──────┘          │
│         ▼                                      │                 │
│  ┌─────────────┐                               │                 │
│  │    iOS      │───── localhost:{port} ────────┘                 │
│  │  Simulator  │                                                 │
│  └─────────────┘                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │ SSH tunnel
                              ▼
              Backend API on server (already done!)
```

### 5.2 iOS Project Structure

```
ios/{AppName}/
├── {AppName}.xcodeproj
├── {AppName}/
│   ├── Models/
│   ├── Services/
│   ├── Views/
│   ├── ContentView.swift
│   ├── {AppName}App.swift
│   └── Assets.xcassets/
└── {AppName}Share/              # Share Extension
```

---

## Phase 6: Chrome Extension Development

### 6.1 Chrome Extension Structure

```
chrome_extension/
├── manifest.json           # Manifest V3 configuration
├── background.js           # Service worker
├── sidebar/
│   ├── sidebar.html
│   ├── sidebar.css
│   └── sidebar.js
└── icons/
```

### 6.2 Manifest V3 Configuration

```json
{
  "manifest_version": 3,
  "name": "{App Name}",
  "version": "1.0.0",
  "permissions": ["activeTab", "contextMenus", "sidePanel", "storage"],
  "host_permissions": ["http://localhost:4300/*", "https://api.yourdomain.com/*"],
  "background": { "service_worker": "background.js" },
  "side_panel": { "default_path": "sidebar/sidebar.html" },
  "action": { "default_title": "{App Name}" }
}
```

---

## Phase 7: Android Mobile App Development

### 7.1 Important: Android Emulator Networking

**The Android Emulator cannot use `localhost` to reach your Mac.**

Use `10.0.2.2` instead — this is the emulator's alias for the host machine:

```kotlin
object Config {
    const val API_BASE_URL = "http://10.0.2.2:4300"
}
```

### 7.2 Android Project Structure

```
android/{AppName}/
├── app/
│   ├── src/main/
│   │   ├── java/com/{domain}/{appname}/
│   │   │   ├── MainActivity.kt
│   │   │   ├── data/api/
│   │   │   ├── ui/screens/
│   │   │   ├── ui/components/
│   │   │   ├── ui/theme/
│   │   │   └── viewmodel/
│   │   ├── res/
│   │   └── AndroidManifest.xml
│   └── build.gradle.kts
└── settings.gradle.kts
```

---

## Phase 8: Testing & QA

### 8.1 Testing Checklists

**All Platforms:**
- [ ] Empty inputs handled
- [ ] Very long inputs handled
- [ ] Network errors show properly
- [ ] Loading states display
- [ ] Results render correctly

**iOS Share Extension:**
- [ ] Extension appears in share sheet
- [ ] Receives text from Notes, Safari
- [ ] Done button closes extension

**Chrome Extension:**
- [ ] Context menu appears on text selection
- [ ] Sidebar opens correctly
- [ ] Text auto-populates from selection

**Android Share Intent:**
- [ ] App appears in share sheet
- [ ] Receives text from Chrome, Notes
- [ ] Text is editable before analysis

---

## Phase 9: Deployment & Launch

### 9.1 Backend Deployment

```bash
pm2 save
pm2 startup
# Set up HTTPS with Let's Encrypt or Cloudflare
```

### 9.2 Update Client Configs for Production

```swift
// iOS: Config.swift
static let apiBaseURL = "https://api.yourdomain.com"
```
```kotlin
// Android: Config.kt
const val API_BASE_URL = "https://api.yourdomain.com"
```
```javascript
// Chrome: background.js
const API_BASE_URL = 'https://api.yourdomain.com';
```

---

# PART TWO: iOS DEVELOPMENT DEEP DIVE

## Development Environment Setup

```bash
# Install Claude Code on Mac
brew install node
npm install -g @anthropic-ai/claude-code

# Clone and start
git clone git@github.com:jagents/{projectname}.git ~/projects/{projectname}
cd ~/projects/{projectname}
claude
```

## How Claude Code + Xcode Work Together

1. Open Terminal, cd to your project, run `claude`
2. Tell Claude Code what to build ("create the InputView screen")
3. Claude Code writes/edits `.swift` files
4. Switch to Xcode, press ⌘R to build and run
5. See if it works in Simulator
6. Go back to Claude Code: "the button doesn't do anything, fix it"
7. Repeat

## Key iOS Implementation Details

### Info.plist Configuration for Local Networking

```xml
<key>NSAppTransportSecurity</key>
<dict>
    <key>NSAllowsLocalNetworking</key>
    <true/>
</dict>
```

### API Client Pattern (Actor-Based)

```swift
actor APIClient {
    static let shared = APIClient()

    func analyze(request: AnalyzeRequest) async throws -> AnalyzeResponse {
        var urlRequest = URLRequest(url: URL(string: "\(Config.apiBaseURL)/v1/analyze")!)
        urlRequest.httpMethod = "POST"
        urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        urlRequest.httpBody = try JSONEncoder().encode(request)
        let (data, _) = try await URLSession.shared.data(for: urlRequest)
        return try JSONDecoder().decode(AnalyzeResponse.self, from: data)
    }
}
```

### CodingKeys for Snake Case

```swift
struct AnalyzeResponseData: Codable {
    let slangGlossary: [SlangEntry]?

    enum CodingKeys: String, CodingKey {
        case slangGlossary = "slang_glossary"
    }
}
```

## Share Extension Development

### Adding a Share Extension Target

1. In Xcode: File → New → Target → Share Extension
2. Name it `{AppName}Share`
3. Configure activation rule in Info.plist for text

---

# PART THREE: CHROME EXTENSION DEEP DIVE

## Service Worker & Messaging

### background.js Key Patterns

```javascript
const API_BASE_URL = 'http://localhost:4300';

// Create context menu on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'analyze-text',
    title: 'Analyze with {App Name}',
    contexts: ['selection']
  });
});

// Handle context menu click
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'analyze-text' && info.selectionText) {
    chrome.storage.local.set({
      pendingAnalysis: { text: info.selectionText, timestamp: Date.now() }
    });
    // IMPORTANT: Must open synchronously for user gesture
    chrome.sidePanel.open({ tabId: tab.id });
  }
});
```

### Important: User Gesture Requirement

`chrome.sidePanel.open()` must be called **synchronously** in the event handler. Using `await` before it breaks the gesture chain:

```javascript
// WRONG - breaks user gesture
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  await chrome.storage.local.set({ ... }); // async breaks gesture!
  chrome.sidePanel.open({ tabId: tab.id }); // FAILS
});

// CORRECT - synchronous
chrome.contextMenus.onClicked.addListener((info, tab) => {
  chrome.storage.local.set({ ... }); // fire and forget
  chrome.sidePanel.open({ tabId: tab.id }); // WORKS
});
```

---

# PART FOUR: ANDROID DEVELOPMENT DEEP DIVE

## Key Android Implementation Details

### AndroidManifest.xml Configuration

```xml
<manifest>
    <uses-permission android:name="android.permission.INTERNET" />
    <application android:usesCleartextTraffic="true">
        <activity android:name=".MainActivity">
            <!-- Normal launcher -->
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
            <!-- Share intent -->
            <intent-filter>
                <action android:name="android.intent.action.SEND" />
                <category android:name="android.intent.category.DEFAULT" />
                <data android:mimeType="text/plain" />
            </intent-filter>
        </activity>
    </application>
</manifest>
```

### Data Models with Serialization

```kotlin
@Serializable
data class AnalyzeResponseData(
    val interpretations: List<Interpretation>,
    @SerialName("slang_glossary")
    val slangGlossary: List<SlangEntry>?,
    @SerialName("parent_perspective")
    val parentPerspective: String?
)
```

### Handling Share Intent

```kotlin
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val sharedText = when (intent?.action) {
            Intent.ACTION_SEND -> intent.getStringExtra(Intent.EXTRA_TEXT)
            else -> null
        }
        setContent {
            AppTheme { AppNavigation(initialText = sharedText) }
        }
    }
}
```

---

# PART FIVE: INFRASTRUCTURE REFERENCE

## Cloud Provider: DigitalOcean

| Setting | Value |
|---------|-------|
| **Droplet Name** | dragondance1 |
| **Region** | SFO2 (San Francisco) |
| **OS** | Ubuntu 25.04 x64 |
| **Specs** | 4 vCPUs / 8 GB RAM / 160 GB Disk |
| **IPv4** | 157.245.191.245 |

## Database: Neon (Serverless PostgreSQL)

- **Why Neon**: Serverless, scales to zero, built-in connection pooling, pgvector support
- **Naming Convention**: `{projectname}_db`

## Port Reservations

| Port | Project | Service |
|------|---------|---------|
| 3001 | aidmin | Node app |
| 3101-3103 | Scholar Agent Swarm | Agents |
| 4204 | Scholar Agent Swarm | PaperSummarizer |
| 4300 | execfunc/betweenlines | Main app |
| 4301 | execfunc/timetogo | (reserved) |
| 4302-4305 | execfunc/* | (reserved) |
| 4400 | scouting/scoutsim | Scout Conference Simulator |
| 4402 | scouting/uniforminspector | Uniform Inspector General |
| 4403 | scouting/gearguru | Gear Guru |
| 4404 | scouting/scoutquizzer | Scout Knowledge Quizzer |
| 4405 | scouting/requirementscoach | Scout Requirements Coach |
| 4406 | scouting/meritbadgecoach | Scout Merit Badge Coach |
| 4410 | scouting/middleware | Scout Middleware (Entitlement Service) |
| 5205 | Scholar Agent Swarm | Paper Discovery |
| 5300 | execfunc/betweenlines | Dashboard/UI |

**Available port ranges**: 3200-3299, 4407-4409, 4411-4499, 5400-5499

## User Accounts Summary

| User | Purpose | Default Directory |
|------|---------|-------------------|
| `aiadmin` | Top-level admin | `/home/aiadmin` |
| `scholardev` | Scholar Agent Swarm | `/aiprojects/scholarswarm/scholarproject` |
| `efuncdev` | Executive Function apps | `/aiprojects/execfunc/betweenlines` |
| `scoutdev` | Scout App Studio (6 apps + middleware) | `/aiprojects/scouting/` |

---

# PART SIX: OPERATIONAL REFERENCE

## Termius & Port Forwarding

**Configuration**:
- **Label**: `PF {port} ({description})`
- **Local port**: Same as remote
- **Bind address**: `127.0.0.1`
- **Host**: Select appropriate user host
- **Destination**: `localhost`

**iOS Simulator**: Uses Mac's network, so `localhost:4300` works directly.

**Android Emulator**: Use `http://10.0.2.2:4300`

## pm2 Process Management

```bash
pm2 start ecosystem.config.cjs
pm2 restart {app}
pm2 logs {app} --lines 100
pm2 status
pm2 save
pm2 startup
```

## Troubleshooting

### iOS Simulator can't reach API
- Verify Termius port forwarding is active on Mac
- Check Info.plist has local networking allowed

### Android Emulator can't reach API
- Use `10.0.2.2` not `localhost`
- Verify port forwarding active on Mac
- Check `usesCleartextTraffic="true"` in manifest

### Chrome Extension not loading
- Check for manifest errors in `chrome://extensions`
- Check service worker for errors (click "service worker" link)

---

# PART SEVEN: CLAUDE CODE PATTERNS

## Planning Documents

| Document | Purpose | When |
|----------|---------|------|
| `claudecodePlanv1.md` | Overall execution plan | Start |
| `claudecode{Feature}Planv1.md` | Feature-specific | Before major feature |
| `MacDeskClaudeCode{Feature}Planv1.md` | Mac work | Before iOS/Android/Chrome |

## Multi-Machine Handoff

### Server → Mac Handoff

1. Complete backend/web on server
2. Run tests, verify passing
3. Update planning docs with API contract, test inputs
4. Commit and push

---

# PART EIGHT: GITHUB WORKFLOWS

## Multi-Machine Git Flow

```
Server                      GitHub                      Mac
   | git push                 |                          |
   |------------------------->|                          |
   |                          |   git pull               |
   |                          |<-------------------------|
   |                          |   (work on clients)      |
   |                          |   git push               |
   |                          |<-------------------------|
   | git pull                 |                          |
   |<-------------------------|                          |
```

## Avoiding Conflicts

- Server handles: `backend/`, `web/`, `prompts/`
- Mac handles: `ios/`, `android/`, `chrome_extension/`

---

# PART NINE: MULTI-APP PORTFOLIO STRUCTURE

## ExecFunc Portfolio Strategy

| App | Status | Port | Color |
|-----|--------|------|-------|
| Read Between the Lines | **Complete** | 4300 | Phthalo Purple (#2D1B4E) |
| Time to Go | **Complete** | 4301 | Phthalo Green (#123524) |
| Just Start | **Next** | 4302 | Phthalo Crimson (#6B1C2A) |
| Transition DJ | Planned | 4303 | Phthalo Turquoise (#0D4F4F) |
| Overwhelm Triage | Later | 4304 | Phthalo Olive (#3D3D1C) |

> **See:** `/aiprojects/execfunc/timetogo/ExecFuncAppStrategyv4.md` for full portfolio strategy and design system.

## Shared Infrastructure

All apps under `/aiprojects/execfunc/` share:
- Same Linux user (`efuncdev`)
- Same installed tools
- Same GitHub account
- Same Termius connection
- Different ports per app
- **Same ExecFunc Design System (NEW v5)**

---

# PART TEN: AI/LLM PROCESSING PATTERNS

## Multi-Pass Pipeline Architecture

```
Input Text
    │
    ▼
┌─────────────────────────────────────────┐
│ PASS 0: Pre-Processing / Detection       │  Lower temp (0.3)
│ - Detect input structure                 │  Deterministic
│ - Parse into normalized format           │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│ PASS 1: Safety / Guardrails              │  Lower temp (0.3)
│ - Content moderation                     │  Conservative
│ - Flag detection                         │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│ PASS 2: Main Processing                  │  Higher temp (0.7)
│ - Core business logic                    │  Creative
│ - Generate outputs                       │
└─────────────────────────────────────────┘
    │
    ▼
Output Response
```

## Content Moderation Pattern

```typescript
interface SafetyResult {
  severity: 0 | 1 | 2 | 3;  // 0 = none, 3 = critical
  flags: string[];
  isRedFlag: boolean;
}

// Severity-based response modification
if (safetyResult.severity >= 2) {
  response.suggestedReplies = [];  // Withhold suggestions
  response.repliesWithheld = true;
}
```

## Temperature Guidelines

| Task Type | Temperature | Rationale |
|-----------|-------------|-----------|
| Classification | 0.0-0.3 | Deterministic, consistent |
| Safety/Moderation | 0.3 | Conservative, predictable |
| Analysis/Interpretation | 0.7 | Some creativity allowed |
| Creative Writing | 0.9-1.0 | Maximum creativity |

---

# PART ELEVEN: CROSS-PLATFORM PATTERNS

## JSON Serialization Reference

### TypeScript/JavaScript (Backend & Web)
```typescript
interface Response {
  slang_glossary: SlangEntry[];
  suggested_replies: Reply[];
}
```

### Swift (iOS)
```swift
struct Response: Codable {
    let slangGlossary: [SlangEntry]
    enum CodingKeys: String, CodingKey {
        case slangGlossary = "slang_glossary"
    }
}
```

### Kotlin (Android)
```kotlin
@Serializable
data class Response(
    @SerialName("slang_glossary")
    val slangGlossary: List<SlangEntry>
)
```

## UI State Management Patterns

### Kotlin Sealed Interface (Android)

```kotlin
sealed interface UiState<out T> {
    data object Idle : UiState<Nothing>
    data object Loading : UiState<Nothing>
    data class Success<T>(val data: T) : UiState<T>
    data class Error(val message: String) : UiState<Nothing>
}

// Usage in Composable
when (val currentState = state.collectAsState().value) {
    is UiState.Idle -> IdleView()
    is UiState.Loading -> LoadingSpinner()
    is UiState.Success -> ResultsView(currentState.data)
    is UiState.Error -> ErrorView(currentState.message)
}
```

## Entry Point Patterns

| Platform | Entry Point | Key Pattern |
|----------|-------------|-------------|
| iOS | Share Extension | `extensionContext?.completeRequest()` |
| Android | Share Intent | `Intent.ACTION_SEND` + `EXTRA_TEXT` |
| Chrome | Context Menu | Store text, then `sidePanel.open()` synchronously |
| Web | URL Parameters | `?text=` query param |

---

# PART TWELVE: TESTING PATTERNS

## Test Input Library

```javascript
const TEST_INPUTS = {
    simple: "hey what's up, you coming tonight?",
    long: "...".repeat(1000),
    empty: "",
    unicode: "Check this out 🔥 それは面白いね",
    multiPerson: `John: hey you coming?\nMe: maybe\nJohn: come on!`,
    safety: "Don't tell your parents. Can you send me a pic?",
    slang: "yo that fit is bussin no cap fr fr",
    ambiguous: "I guess that's fine..."
};
```

## Edge Case Categories

- **Input**: Empty, whitespace only, max length, single character
- **Network**: Timeout, 500 error, invalid JSON, slow response
- **AI Response**: Empty arrays, missing fields, unexpected values

---

# PART THIRTEEN: MONETIZATION & ENTITLEMENTS

## The Philosophy: "Paramedic First"

**Core principle: We never block the rescue.**

| Good | Bad |
|------|-----|
| 5 free analyses/day, then upsell | Paywall on first launch |
| Premium features enhance, not unlock | Core feature locked |
| Upgrade prompt after successful use | Upgrade prompt blocking action |

## Channel Strategy

- **Web/Chrome**: Zero friction showroom, email capture, drives mobile download
- **Mobile**: Revenue engine via Apple IAP / Google Billing

## Rate Limiting Implementation

```typescript
const FREE_LIMITS = {
  default: 5,
  email_unlocked: 10,
  premium: Infinity
};

export async function rateLimitMiddleware(c: Context, next: Next) {
  const deviceId = c.req.header('x-device-id');
  const entitlement = await checkEntitlement(deviceId);
  if (entitlement === 'premium') return next();

  // Check bucket, return 429 if exceeded
  // Include upgrade_options in response
}
```

## Device Identity Patterns

| Platform | Storage | Survives Reinstall |
|----------|---------|-------------------|
| iOS | Keychain | Yes |
| Android | SharedPreferences | No (EncryptedSharedPrefs for sensitive) |
| Chrome | chrome.storage.local | No (cleared with extension) |
| Web | IP-based (server-side) | N/A |

---

# PART FOURTEEN: EXECFUNC DESIGN SYSTEM (NEW v5)

This section documents the complete ExecFunc Design System — a Phthalo Purple theme optimized for ADHD/executive function users.

---

## Phthalo Purple Theme

### Color Palette

| Color Name | Hex | RGB | Usage |
|------------|-----|-----|-------|
| **PhthaloPrimary** | `#4A3B5C` | 74, 59, 92 | Primary buttons, headers, key actions |
| **PhthaloAccent** | `#6B5B7E` | 107, 91, 126 | Secondary elements, borders |
| **PhthaloAccentSecondary** | `#9A7FC2` | 154, 127, 194 | Highlights, links |
| **PhthaloLightTint** | `#F5F3F7` | 245, 243, 247 | Backgrounds, cards |

### Semantic Colors

| Name | Hex | Usage |
|------|-----|-------|
| **LikelyColor** | `#22C55E` | High-confidence indicators |
| **PossibleColor** | `#F59E0B` | Medium-confidence indicators |
| **UnlikelyColor** | `#9CA3AF` | Low-confidence indicators |
| **DangerRed** | `#DC2626` | Safety warnings, red flags |
| **WarningOrange** | `#EA580C` | Caution notices |
| **WarningLight** | `#FFF7ED` | Warning backgrounds |

### Platform Implementations

#### iOS (SwiftUI)
```swift
// Colors.swift
extension Color {
    static let phthaloPrimary = Color(red: 74/255, green: 59/255, blue: 92/255)
    static let phthaloAccent = Color(red: 107/255, green: 91/255, blue: 126/255)
    static let phthaloLightTint = Color(red: 245/255, green: 243/255, blue: 247/255)
}
```

#### Android (Jetpack Compose)
```kotlin
// Color.kt
val PhthaloPrimary = Color(0xFF4A3B5C)
val PhthaloAccent = Color(0xFF6B5B7E)
val PhthaloAccentSecondary = Color(0xFF9A7FC2)
val PhthaloLightTint = Color(0xFFF5F3F7)

val LikelyColor = Color(0xFF22C55E)
val PossibleColor = Color(0xFFF59E0B)
val UnlikelyColor = Color(0xFF9CA3AF)
val DangerRed = Color(0xFFDC2626)
```

#### Chrome Extension (CSS)
```css
:root {
    --phthalo-primary: #4A3B5C;
    --phthalo-accent: #6B5B7E;
    --phthalo-accent-secondary: #9A7FC2;
    --phthalo-light-tint: #F5F3F7;

    --likely-color: #22C55E;
    --possible-color: #F59E0B;
    --unlikely-color: #9CA3AF;
    --danger-red: #DC2626;
}
```

---

## Typography Standards

### Font Hierarchy

| Level | iOS | Android | Chrome/Web |
|-------|-----|---------|------------|
| **Title** | `.title` (28pt) | `headlineMedium` | `1.5rem bold` |
| **Subtitle** | `.headline` (17pt) | `titleMedium` | `1.1rem` |
| **Body** | `.body` (17pt) | `bodyMedium` | `1rem` |
| **Caption** | `.caption` (12pt) | `bodySmall` | `0.875rem` |

### App Header Pattern

All ExecFunc apps use this header pattern on the main input screen:

```
┌────────────────────────────────────┐
│     [Gradient Background]      │
│                                │
│      App Title (centered)      │
│    Subtitle (centered, gray)   │
│                                │
└────────────────────────────────┘
```

#### iOS Implementation
```swift
VStack {
    Text("Between the Lines")
        .font(.title)
        .fontWeight(.bold)
        .foregroundColor(.phthaloPrimary)
    Text("Understand what they really mean")
        .font(.subheadline)
        .foregroundColor(.secondary)
}
```

#### Android Implementation
```kotlin
Column(horizontalAlignment = Alignment.CenterHorizontally) {
    Text(
        text = "Between the Lines",
        style = MaterialTheme.typography.headlineMedium,
        fontWeight = FontWeight.Bold,
        color = PhthaloPrimary
    )
    Text(
        text = "Understand what they really mean",
        style = MaterialTheme.typography.bodyMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant
    )
}
```

---

## Component Patterns

### Cards

All content sections use cards with consistent styling:

```kotlin
// Android
Card(
    colors = CardDefaults.cardColors(containerColor = Color.White),
    elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
    shape = RoundedCornerShape(12.dp)
)
```

```swift
// iOS
RoundedRectangle(cornerRadius: 12)
    .fill(Color.white)
    .shadow(radius: 2)
```

### Gradient Backgrounds

Input screens use a subtle gradient from PhthaloLightTint to white:

```kotlin
// Android
val gradientBrush = Brush.verticalGradient(
    colors = listOf(PhthaloLightTint, Color.White),
    startY = 0f,
    endY = 600f
)
Box(modifier = Modifier.background(gradientBrush))
```

```css
/* Chrome/Web */
background: linear-gradient(to bottom, var(--phthalo-light-tint) 0%, white 100%);
```

---

# PART FIFTEEN: COLLAPSIBLE SECTIONS PATTERN (NEW v5)

---

## Design Principles

1. **Reduce cognitive load**: Hide secondary information by default
2. **Progressive disclosure**: User reveals details when ready
3. **Consistent interaction**: Same expand/collapse pattern everywhere

## Arrow Direction Convention

**CRITICAL**: Use consistent arrow directions across all platforms:

| State | Arrow | Icon |
|-------|-------|------|
| **Collapsed** | Points right → | `chevron.right` / `KeyboardArrowRight` |
| **Expanded** | Points down ↓ | `chevron.down` / `KeyboardArrowDown` |

**Why this convention?**
- Right arrow suggests "more content available" (like a tree view)
- Down arrow shows content is revealed below
- Matches iOS native patterns (Settings app, etc.)

## Default Expansion States

| Section | Default State | Rationale |
|---------|---------------|-----------|
| Primary content (Interpretations) | **Expanded** | Most important info |
| Parent Perspective | **Expanded** | User opted in to this |
| Secondary analysis (Tone, Participants) | **Collapsed** | Available but not primary |
| Reference info (Slang, Transcript) | **Collapsed** | Supporting details |

## Platform Implementations

### iOS (SwiftUI)

```swift
struct CollapsibleSection<Content: View>: View {
    let title: String
    let defaultExpanded: Bool
    @ViewBuilder let content: () -> Content

    @State private var isExpanded: Bool

    init(title: String, defaultExpanded: Bool = false, @ViewBuilder content: @escaping () -> Content) {
        self.title = title
        self.defaultExpanded = defaultExpanded
        self.content = content
        self._isExpanded = State(initialValue: defaultExpanded)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Button(action: { withAnimation { isExpanded.toggle() } }) {
                HStack {
                    Text(title).font(.headline)
                    Spacer()
                    Image(systemName: isExpanded ? "chevron.down" : "chevron.right")
                }
            }

            if isExpanded {
                content()
                    .padding(.top, 8)
            }
        }
        .padding()
        .background(Color.white)
        .cornerRadius(12)
    }
}
```

### Android (Jetpack Compose)

```kotlin
@Composable
fun CollapsibleSection(
    title: String,
    defaultExpanded: Boolean = false,
    content: @Composable () -> Unit
) {
    var expanded by remember { mutableStateOf(defaultExpanded) }

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { expanded = !expanded },
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(title, style = MaterialTheme.typography.titleMedium)
                Icon(
                    imageVector = if (expanded)
                        Icons.Filled.KeyboardArrowDown
                    else
                        Icons.AutoMirrored.Filled.KeyboardArrowRight,
                    contentDescription = if (expanded) "Collapse" else "Expand"
                )
            }

            AnimatedVisibility(visible = expanded) {
                Column(modifier = Modifier.padding(top = 12.dp)) {
                    content()
                }
            }
        }
    }
}
```

### Chrome Extension (JavaScript)

```javascript
function createCollapsibleSection(title, content, defaultExpanded = false) {
    const section = document.createElement('div');
    section.className = 'collapsible-section';

    const header = document.createElement('div');
    header.className = 'section-header';
    header.innerHTML = `
        <span class="section-title">${escapeHtml(title)}</span>
        <span class="section-arrow">${defaultExpanded ? '▼' : '▶'}</span>
    `;

    const body = document.createElement('div');
    body.className = 'section-body';
    body.style.display = defaultExpanded ? 'block' : 'none';
    body.appendChild(content);

    header.addEventListener('click', () => {
        const isExpanded = body.style.display !== 'none';
        body.style.display = isExpanded ? 'none' : 'block';
        header.querySelector('.section-arrow').textContent = isExpanded ? '▶' : '▼';
    });

    section.appendChild(header);
    section.appendChild(body);
    return section;
}
```

```css
.collapsible-section {
    background: white;
    border-radius: 12px;
    margin-bottom: 12px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}
.section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px;
    cursor: pointer;
}
.section-title {
    font-weight: 600;
    color: var(--phthalo-primary);
}
.section-arrow {
    color: var(--phthalo-accent);
    font-size: 12px;
}
```

---

# PART SIXTEEN: INPUT CONTROLS PATTERN (NEW v5)

---

## Dropdowns & Selection

### When to Use
- Enumerated options (relationship type, reply style)
- 3-8 options (use radio buttons for 2, search for 8+)

### iOS Implementation

```swift
Picker("Relationship", selection: $selectedRelationship) {
    ForEach(relationshipOptions, id: \.value) { option in
        Text(option.label).tag(option.value)
    }
}
.pickerStyle(.menu)
```

### Android Implementation (ExposedDropdownMenuBox)

```kotlin
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DropdownSelector(
    label: String,
    options: List<Pair<String, String>>,  // value to label
    selected: String,
    onSelect: (String) -> Unit
) {
    var expanded by remember { mutableStateOf(false) }

    Column {
        Text(label, style = MaterialTheme.typography.labelMedium)
        ExposedDropdownMenuBox(
            expanded = expanded,
            onExpandedChange = { expanded = !expanded }
        ) {
            OutlinedTextField(
                value = options.find { it.first == selected }?.second ?: "",
                onValueChange = {},
                readOnly = true,
                trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded) },
                modifier = Modifier.menuAnchor().fillMaxWidth()  // menuAnchor() is CRITICAL!
            )
            ExposedDropdownMenu(
                expanded = expanded,
                onDismissRequest = { expanded = false }
            ) {
                options.forEach { (value, label) ->
                    DropdownMenuItem(
                        text = { Text(label) },
                        onClick = {
                            onSelect(value)
                            expanded = false
                        }
                    )
                }
            }
        }
    }
}
```

**CRITICAL**: The `.menuAnchor()` modifier is required on the OutlinedTextField or the dropdown won't open!

### Chrome Extension Implementation

```html
<select id="relationship-select">
    <option value="unknown">Unknown</option>
    <option value="friend">Friend</option>
    <option value="family">Family</option>
    <option value="work">Work</option>
    <option value="dating">Dating</option>
</select>
```

---

## Checkboxes & Toggles

### iOS
```swift
Toggle("Parent Mode", isOn: $parentModeEnabled)
    .tint(.phthaloPrimary)
```

### Android
```kotlin
Row(verticalAlignment = Alignment.CenterVertically) {
    Checkbox(
        checked = parentModeEnabled,
        onCheckedChange = { parentModeEnabled = it },
        colors = CheckboxDefaults.colors(checkedColor = PhthaloPrimary)
    )
    Text("Parent Mode", style = MaterialTheme.typography.bodyMedium)
}
```

### Chrome
```html
<label class="checkbox-label">
    <input type="checkbox" id="parent-mode">
    <span>Parent Mode</span>
</label>
```

---

## Options Passing Through Stack

### Pattern: UI → ViewModel → API

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Screen    │ →  │  ViewModel  │ →  │  API Call   │
│             │    │             │    │             │
│ relationship│    │ analyze(    │    │ POST /v1/   │
│ replyStyle  │    │   text,     │    │   analyze   │
│ parentMode  │    │   options   │    │             │
└─────────────┘    └─────────────┘    └─────────────┘
```

### Android Example

```kotlin
// InputScreen.kt - collect options
Button(onClick = {
    onAnalyze(text, selectedRelationship, selectedReplyStyle, parentModeEnabled)
}) { Text("Interpret") }

// Navigation.kt - pass to ViewModel
InputScreen(
    viewModel = viewModel,
    onAnalyze = { text, relationship, replyStyle, parentMode ->
        viewModel.analyze(text, relationship, replyStyle, parentMode)
        navController.navigate(Screen.Results.route)
    }
)

// ViewModel - build request
fun analyze(text: String, relationship: String, replyStyle: String, parentMode: Boolean) {
    val request = AnalyzeRequest(
        text = text,
        relationshipContext = relationship,
        replyStyle = replyStyle,
        parentMode = parentMode
    )
    // make API call...
}
```

---

# PART SEVENTEEN: CROSS-PLATFORM UI CONSISTENCY (NEW v5)

---

## iOS as Source of Truth

**Key principle**: iOS app is the visual design reference. Other platforms match it.

### Why iOS First?
1. SwiftUI provides clean, native-feeling defaults
2. Apple's HIG is well-documented
3. iOS users have highest design expectations
4. Easier to adapt iOS patterns to other platforms than vice versa

### Process
1. Build and polish iOS UI first
2. Take screenshots of every screen/state
3. Use screenshots as reference when building Android/Chrome
4. Compare side-by-side frequently

---

## Visual Parity Checklist

When implementing a screen on a new platform, verify:

### Layout
- [ ] Header position and alignment matches
- [ ] Spacing between elements matches
- [ ] Card/section padding matches
- [ ] Button size and position matches

### Typography
- [ ] Title size and weight matches
- [ ] Body text size matches
- [ ] Color contrast matches

### Colors
- [ ] Primary color applied to same elements
- [ ] Background gradients match
- [ ] Status colors (likely/possible/unlikely) match
- [ ] Warning/danger colors match

### Interactions
- [ ] Expand/collapse arrow direction matches
- [ ] Default expansion states match
- [ ] Button states (enabled/disabled) match
- [ ] Loading indicators match

---

## Common Divergence Points

### Header/Title Area

| Issue | iOS Default | Android Default | Fix |
|-------|-------------|-----------------|-----|
| Title alignment | Centered | Left-aligned (TopAppBar) | Use custom header, not TopAppBar |
| Gradient | Custom | None | Add Brush.verticalGradient |
| Subtitle | Below title | None | Add explicit Text below title |

### Input Fields

| Issue | iOS Default | Android Default | Fix |
|-------|-------------|-----------------|-----|
| Placeholder text | Shows hint | Shows hint | Remove if iOS doesn't have it |
| Border style | Rounded | Outlined | Use OutlinedTextField with custom shape |

### Cards

| Issue | iOS Default | Android Default | Fix |
|-------|-------------|-----------------|-----|
| Corner radius | 12pt typical | 12dp | Match explicitly |
| Shadow | Subtle | Elevation-based | Use CardDefaults.cardElevation(2.dp) |
| Background | White | Surface color | Force Color.White |

---

# PART EIGHTEEN: PLATFORM-SPECIFIC GOTCHAS (NEW v5)

---

## Android Gotchas

### 1. ExposedDropdownMenuBox Won't Open

**Problem**: Dropdown appears but clicking does nothing.

**Cause**: Missing `.menuAnchor()` modifier.

**Fix**:
```kotlin
OutlinedTextField(
    // ...
    modifier = Modifier
        .menuAnchor()  // REQUIRED!
        .fillMaxWidth()
)
```

### 2. Icons Not Found

**Problem**: `Icons.Filled.KeyboardArrowRight` doesn't exist.

**Fix**: Use `Icons.AutoMirrored.Filled.KeyboardArrowRight` for RTL support.

### 3. Emulator Can't Reach API

**Problem**: `localhost:4300` returns connection refused.

**Fix**: Use `10.0.2.2:4300` - the emulator's alias for the host machine.

### 4. State Not Updating UI

**Problem**: ViewModel state changes but Composable doesn't recompose.

**Fix**: Use `collectAsState()` properly:
```kotlin
val uiState by viewModel.uiState.collectAsState()
```

---

## Chrome Extension Gotchas

### 1. sidePanel.open() Fails Silently

**Problem**: Context menu click doesn't open sidebar.

**Cause**: User gesture chain broken by `await`.

**Fix**: Call `sidePanel.open()` synchronously:
```javascript
// WRONG
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  await chrome.storage.local.set({ ... });
  chrome.sidePanel.open({ tabId: tab.id });  // FAILS
});

// CORRECT
chrome.contextMenus.onClicked.addListener((info, tab) => {
  chrome.storage.local.set({ ... });  // fire and forget
  chrome.sidePanel.open({ tabId: tab.id });  // WORKS
});
```

### 2. Changes Not Reflected

**Problem**: Updated code but extension behaves the same.

**Fix**:
1. Go to `chrome://extensions`
2. Click the refresh icon on your extension
3. Close and reopen sidebar

### 3. CSS Variables Not Working

**Problem**: `var(--my-color)` shows default/wrong color.

**Fix**: Define variables in `:root` in your CSS file, ensure CSS file is linked in HTML.

---

## iOS Gotchas

### 1. Share Extension Can't Find Models

**Problem**: Shared code not accessible in extension target.

**Fix**: Add files to both targets:
1. Select the file in Xcode
2. In File Inspector, check both targets under "Target Membership"

### 2. Network Calls Fail in Simulator

**Problem**: API calls fail with transport error.

**Fix**: Add to Info.plist:
```xml
<key>NSAppTransportSecurity</key>
<dict>
    <key>NSAllowsLocalNetworking</key>
    <true/>
</dict>
```

### 3. Previews Don't Work

**Problem**: SwiftUI previews crash or show nothing.

**Fix**: Provide mock data in preview:
```swift
#Preview {
    ResultsView(data: .mock)
}
```

---

## Cross-Platform Lessons Learned

### 1. Read Before You Style

Always read the existing platform code before making styling changes. Understand:
- What color system is already in place
- What component patterns exist
- How state flows through the app

### 2. Test on Device/Emulator Often

Don't assume code changes work. Build and run after every significant change:
- **Xcode**: ⌘R
- **Android Studio**: Click Run (▶)
- **Chrome**: Reload extension, close/reopen sidebar

### 3. Side-by-Side Comparison

When achieving visual parity:
1. Put iOS simulator next to Android emulator
2. Navigate to same screen on both
3. Compare element by element
4. Screenshot and overlay if needed

### 4. Options Must Flow All the Way

When adding new options (like `parentMode`):
1. Add to UI state (checkbox, toggle)
2. Add to callback signature
3. Add to ViewModel method
4. Add to Request model
5. Add to API call
6. Verify backend accepts it

Missing any step = option is silently ignored.

---

# PART NINETEEN: CROSS-APP MIDDLEWARE FOR SUITE MONETIZATION (NEW v7)

When building a suite of related apps (like Scout App Studio with 6 apps), managing entitlements, user identity, and analytics individually in each app creates duplication, inconsistency, and maintenance burden. This section describes the centralized middleware pattern that solves these problems.

---

## The Problem It Solves

### Without Middleware (Each App Manages Own Entitlements)

```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   App 1      │  │   App 2      │  │   App 3      │
├──────────────┤  ├──────────────┤  ├──────────────┤
│ Rate Limits  │  │ Rate Limits  │  │ Rate Limits  │
│ Tier Logic   │  │ Tier Logic   │  │ Tier Logic   │
│ Code Redeem  │  │ Code Redeem  │  │ Code Redeem  │
│ Email Capture│  │ Email Capture│  │ Email Capture│
│ Analytics    │  │ Analytics    │  │ Analytics    │
└──────────────┘  └──────────────┘  └──────────────┘
      ↓                 ↓                 ↓
   6 tables          6 tables          6 tables
   (separate)        (separate)        (separate)
```

**Problems:**
- Duplicated entitlement logic across apps
- Inconsistent tier handling
- Can't share premium status across apps
- Code redemption only works in one app
- Analytics scattered across databases
- Email captured multiple times from same user

### With Middleware (Centralized Entitlement Service)

```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   App 1      │  │   App 2      │  │   App 3      │
├──────────────┤  ├──────────────┤  ├──────────────┤
│ App Logic    │  │ App Logic    │  │ App Logic    │
│ App-Specific │  │ App-Specific │  │ App-Specific │
│ Tier Limits  │  │ Tier Limits  │  │ Tier Limits  │
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │                 │                 │
       └────────────┬────┴────────────────┘
                    ▼
        ┌──────────────────────────┐
        │      MIDDLEWARE          │
        ├──────────────────────────┤
        │ Device Identity          │
        │ Tier Management          │
        │ Code Redemption          │
        │ Email Capture            │
        │ Analytics Events         │
        └──────────────────────────┘
                    ↓
              Single Database
              (shared state)
```

**Benefits:**
- Single source of truth for user tier
- Premium code works across all apps in suite
- Email captured once, applies everywhere
- Consistent upgrade flows
- Unified analytics
- Apps focus on their unique value

---

## Architecture Overview

### System Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           APP SUITE CLIENTS                              │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐            │
│  │  Web App  │  │ iOS App   │  │Android App│  │  Chrome   │            │
│  │           │  │           │  │           │  │ Extension │            │
│  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘            │
└────────┼──────────────┼──────────────┼──────────────┼────────────────────┘
         │              │              │              │
         └──────────────┴──────────────┴──────────────┘
                                │
                    ┌───────────▼───────────┐
                    │    APP BACKEND        │
                    │   (e.g., Port 4403)   │
                    ├───────────────────────┤
                    │ middlewareClient.ts   │  ← Calls middleware
                    │ tierLimits.ts         │  ← App-specific limits
                    │ entitlement.ts route  │  ← Proxies + adds limits
                    │ codes.ts route        │  ← Proxies code redeem
                    │ events.ts route       │  ← Proxies analytics
                    └───────────┬───────────┘
                                │
                    ┌───────────▼───────────┐
                    │    MIDDLEWARE         │
                    │   (Port 4410)         │
                    ├───────────────────────┤
                    │ GET /v1/entitlement   │  ← Device tier lookup
                    │ POST /v1/email/capture│  ← Email collection
                    │ POST /v1/codes/redeem │  ← Code validation
                    │ POST /v1/events       │  ← Analytics ingestion
                    └───────────┬───────────┘
                                │
                    ┌───────────▼───────────┐
                    │  SHARED DATABASE      │
                    │   (Neon PostgreSQL)   │
                    ├───────────────────────┤
                    │ devices table         │
                    │ entitlements table    │
                    │ codes table           │
                    │ redemptions table     │
                    │ events table          │
                    └───────────────────────┘
```

### Port Allocation Strategy

Reserve a dedicated port for middleware in your suite's port range:

| Service | Port | Purpose |
|---------|------|---------|
| App 1 | 4400 | Scout Conference Simulator |
| App 2 | 4402 | Uniform Inspector |
| App 3 | 4403 | Gear Guru |
| App 4 | 4404 | Scout Quizzer |
| App 5 | 4405 | Requirements Coach |
| App 6 | 4406 | Merit Badge Coach |
| **Middleware** | **4410** | **Entitlement Service** |

---

## Middleware Service Implementation

### Project Structure

```
middleware/
├── backend/
│   ├── src/
│   │   ├── index.ts              # Entry point
│   │   ├── config.ts             # Environment config
│   │   ├── routes/
│   │   │   ├── entitlement.ts    # Tier lookup
│   │   │   ├── email.ts          # Email capture
│   │   │   ├── codes.ts          # Code redemption
│   │   │   └── events.ts         # Analytics
│   │   ├── services/
│   │   │   ├── entitlement.ts    # Tier logic
│   │   │   ├── codes.ts          # Code validation
│   │   │   └── analytics.ts      # Event processing
│   │   └── db/
│   │       ├── client.ts         # Database connection
│   │       └── migrations/       # Schema migrations
│   ├── package.json
│   └── ecosystem.config.cjs
└── .env
```

### Key Middleware Endpoints

#### GET `/v1/entitlement`
Returns the device's current tier and entitlement source.

```typescript
// Request
GET /v1/entitlement?deviceId=xxx&platform=web

// Response
{
  "success": true,
  "data": {
    "deviceId": "xxx",
    "tier": "email",           // free | email | premium
    "source": "email_capture", // default | email_capture | code_redeem | subscription
    "expiresAt": null,         // null = never expires
    "email": "user@example.com"
  }
}
```

#### POST `/v1/email/capture`
Captures email and upgrades tier from free → email.

```typescript
// Request
POST /v1/email/capture
{
  "deviceId": "xxx",
  "email": "user@example.com",
  "source": "web",           // where captured
  "newsletter": true         // opted into newsletter
}

// Response
{
  "success": true,
  "data": {
    "tier": "email",
    "previousTier": "free"
  }
}
```

#### POST `/v1/codes/redeem`
Validates and redeems a promo, troop, or beta code.

```typescript
// Request
POST /v1/codes/redeem
{
  "deviceId": "xxx",
  "code": "SCOUT2026"
}

// Response (success)
{
  "success": true,
  "data": {
    "tier": "premium",
    "codeType": "promo",
    "expiresAt": "2026-02-16T00:00:00.000Z"  // 30 days
  }
}

// Response (failure)
{
  "success": false,
  "error": "Invalid or expired code"
}
```

#### POST `/v1/events`
Ingests analytics events from apps.

```typescript
// Request
POST /v1/events
{
  "deviceId": "xxx",
  "platform": "web",
  "appId": "gearguru",
  "events": [
    {
      "event": "analysis_completed",
      "timestamp": "2026-01-16T10:30:00.000Z",
      "data": { "itemCount": 15, "readinessScore": 87 }
    }
  ]
}

// Response
{
  "success": true,
  "data": { "eventsProcessed": 1 }
}
```

### Database Schema

```sql
-- Devices table (first seen)
CREATE TABLE devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT UNIQUE NOT NULL,
  platform TEXT NOT NULL,
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW()
);

-- Entitlements table
CREATE TABLE entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT UNIQUE NOT NULL REFERENCES devices(device_id),
  tier TEXT NOT NULL DEFAULT 'free',  -- free, email, premium
  source TEXT NOT NULL DEFAULT 'default',  -- default, email_capture, code_redeem, subscription
  email TEXT,
  newsletter_opt_in BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMPTZ,  -- null = never expires
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Codes table
CREATE TABLE codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  code_type TEXT NOT NULL,  -- promo, troop, beta
  tier_grant TEXT NOT NULL DEFAULT 'premium',
  duration_days INTEGER,  -- null = lifetime
  max_uses INTEGER,  -- null = unlimited
  current_uses INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ,  -- when code itself expires
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Redemptions table (audit trail)
CREATE TABLE redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL REFERENCES devices(device_id),
  code_id UUID NOT NULL REFERENCES codes(id),
  redeemed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Events table
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  app_id TEXT NOT NULL,
  event_name TEXT NOT NULL,
  event_data JSONB,
  event_timestamp TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_entitlements_device ON entitlements(device_id);
CREATE INDEX idx_events_device ON events(device_id);
CREATE INDEX idx_events_app ON events(app_id);
CREATE INDEX idx_events_timestamp ON events(event_timestamp);
```

---

## App Backend Integration

Each app in the suite adds a thin integration layer to communicate with middleware.

### Files to Add

```
backend/src/
├── config/
│   └── tierLimits.ts       # App-specific limits per tier
├── services/
│   └── middlewareClient.ts # HTTP client for middleware
└── routes/
    ├── entitlement.ts      # /v1/entitlement - proxies + adds limits
    ├── codes.ts            # /v1/codes/redeem - proxies
    └── events.ts           # /v1/events - proxies
```

### middlewareClient.ts

```typescript
// backend/src/services/middlewareClient.ts
const MIDDLEWARE_URL = process.env.MIDDLEWARE_URL || 'http://localhost:4410';

export interface MiddlewareEntitlement {
  deviceId: string;
  tier: 'free' | 'email' | 'premium';
  source: string;
  email?: string;
  expiresAt?: string;
}

export async function getEntitlement(
  deviceId: string,
  platform: string
): Promise<MiddlewareEntitlement> {
  const response = await fetch(
    `${MIDDLEWARE_URL}/v1/entitlement?deviceId=${deviceId}&platform=${platform}`
  );
  const data = await response.json();
  if (!data.success) throw new Error(data.error);
  return data.data;
}

export async function captureEmail(
  deviceId: string,
  email: string,
  source: string,
  newsletter: boolean
): Promise<{ tier: string }> {
  const response = await fetch(`${MIDDLEWARE_URL}/v1/email/capture`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId, email, source, newsletter }),
  });
  const data = await response.json();
  if (!data.success) throw new Error(data.error);
  return data.data;
}

export async function redeemCode(
  deviceId: string,
  code: string
): Promise<{ tier: string; codeType: string; expiresAt?: string }> {
  const response = await fetch(`${MIDDLEWARE_URL}/v1/codes/redeem`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId, code }),
  });
  const data = await response.json();
  if (!data.success) throw new Error(data.error);
  return data.data;
}

export async function trackEvents(
  deviceId: string,
  platform: string,
  appId: string,
  events: Array<{ event: string; timestamp: string; data?: Record<string, any> }>
): Promise<void> {
  await fetch(`${MIDDLEWARE_URL}/v1/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId, platform, appId, events }),
  });
}
```

### tierLimits.ts

Each app defines its own limits per tier:

```typescript
// backend/src/config/tierLimits.ts

// Example: Gear Guru limits
export const TIER_LIMITS = {
  free: {
    analysesPerDay: 3,
    comparisonsPerDay: 5,
    customChecklists: 1,
    premiumChecklists: false,
    weatherIntegration: false,
  },
  email: {
    analysesPerDay: 10,
    comparisonsPerDay: 20,
    customChecklists: 3,
    premiumChecklists: false,
    weatherIntegration: false,
  },
  premium: {
    analysesPerDay: -1,  // unlimited
    comparisonsPerDay: -1,  // unlimited
    customChecklists: 10,
    premiumChecklists: true,
    weatherIntegration: true,
  },
} as const;

export type Tier = keyof typeof TIER_LIMITS;
export type TierLimits = typeof TIER_LIMITS[Tier];

export function getLimitsForTier(tier: Tier): TierLimits {
  return TIER_LIMITS[tier] || TIER_LIMITS.free;
}
```

### entitlement.ts Route

Proxies to middleware and enriches with app-specific limits:

```typescript
// backend/src/routes/entitlement.ts
import { Hono } from 'hono';
import { getEntitlement, captureEmail } from '../services/middlewareClient';
import { getLimitsForTier, TIER_LIMITS } from '../config/tierLimits';

const app = new Hono();

// GET /v1/entitlement - Get user's tier with app-specific limits
app.get('/', async (c) => {
  const deviceId = c.req.query('deviceId') || c.req.header('x-device-id');
  const platform = c.req.query('platform') || 'web';

  if (!deviceId) {
    return c.json({ success: false, error: 'Device ID required' }, 400);
  }

  try {
    const entitlement = await getEntitlement(deviceId, platform);
    const limits = getLimitsForTier(entitlement.tier as keyof typeof TIER_LIMITS);

    // Calculate cache expiration (10 days)
    const cacheUntil = new Date();
    cacheUntil.setDate(cacheUntil.getDate() + 10);

    return c.json({
      success: true,
      data: {
        tier: entitlement.tier,
        source: entitlement.source,
        cache_until: cacheUntil.toISOString(),
        features: limits,
        upgradeOptions: getUpgradeOptions(entitlement.tier),
      },
    });
  } catch (error) {
    console.error('Entitlement error:', error);
    // Fallback to free tier on error
    return c.json({
      success: true,
      data: {
        tier: 'free',
        source: 'default',
        features: getLimitsForTier('free'),
        upgradeOptions: getUpgradeOptions('free'),
      },
    });
  }
});

// POST /v1/entitlement/unlock - Capture email to upgrade tier
app.post('/unlock', async (c) => {
  const body = await c.req.json();
  const { deviceId, email, newsletter = false } = body;

  if (!deviceId || !email) {
    return c.json({ success: false, error: 'Device ID and email required' }, 400);
  }

  try {
    const result = await captureEmail(deviceId, email, 'web', newsletter);
    const limits = getLimitsForTier(result.tier as keyof typeof TIER_LIMITS);

    return c.json({
      success: true,
      data: {
        tier: result.tier,
        features: limits,
      },
    });
  } catch (error) {
    console.error('Email capture error:', error);
    return c.json({ success: false, error: 'Failed to capture email' }, 500);
  }
});

function getUpgradeOptions(currentTier: string) {
  if (currentTier === 'premium') return [];
  const options = [];
  if (currentTier === 'free') {
    options.push({
      type: 'email',
      label: 'Unlock more features',
      description: 'Provide your email to unlock additional daily uses',
    });
  }
  options.push({
    type: 'code',
    label: 'Redeem a code',
    description: 'Enter a promo or troop code for premium access',
  });
  return options;
}

export default app;
```

---

## Client-Side Implementation

### 10-Day Entitlement Caching

To reduce server load and support offline usage, clients cache entitlement for 10 days with a warning on days 8-9.

```javascript
// web/js/entitlement.js

const CACHE_KEYS = {
  entitlement: 'entitlement_cache',
  cacheDate: 'entitlement_cache_date',
};

// Check cache status
function checkCacheStatus() {
  const cacheDate = localStorage.getItem(CACHE_KEYS.cacheDate);
  if (!cacheDate) return { valid: false, warning: false, daysOld: null };

  const daysSinceCache = (Date.now() - new Date(cacheDate).getTime()) / (1000 * 60 * 60 * 24);

  return {
    valid: daysSinceCache < 10,
    warning: daysSinceCache >= 8 && daysSinceCache < 10,
    daysOld: Math.floor(daysSinceCache),
  };
}

// Get entitlement (from cache or server)
async function getEntitlement(forceRefresh = false) {
  const cacheStatus = checkCacheStatus();

  // Return cached if valid and not forcing refresh
  if (!forceRefresh && cacheStatus.valid) {
    const cached = localStorage.getItem(CACHE_KEYS.entitlement);
    if (cached) {
      const entitlement = JSON.parse(cached);
      entitlement._fromCache = true;
      entitlement._cacheWarning = cacheStatus.warning;
      return entitlement;
    }
  }

  // Fetch from server
  try {
    const response = await fetch(`/v1/entitlement?deviceId=${getDeviceId()}&platform=web`);
    const data = await response.json();

    if (data.success) {
      // Cache the result
      localStorage.setItem(CACHE_KEYS.entitlement, JSON.stringify(data.data));
      localStorage.setItem(CACHE_KEYS.cacheDate, new Date().toISOString());
      return data.data;
    }
  } catch (error) {
    console.error('Failed to fetch entitlement:', error);
    // Fall back to cache even if expired
    const cached = localStorage.getItem(CACHE_KEYS.entitlement);
    if (cached) return JSON.parse(cached);
  }

  // Ultimate fallback
  return { tier: 'free', features: DEFAULT_FREE_LIMITS };
}

// Show connectivity warning banner
function showConnectivityWarning() {
  const banner = document.createElement('div');
  banner.className = 'connectivity-warning';
  banner.innerHTML = `
    <span>Your subscription status may be out of date.</span>
    <button onclick="refreshEntitlement()">Refresh Now</button>
  `;
  document.body.prepend(banner);
}

// Refresh entitlement
async function refreshEntitlement() {
  const entitlement = await getEntitlement(true);
  updateTierUI(entitlement);
  hideConnectivityWarning();
}
```

### Tier Badge Display

```javascript
// Show current tier in header
function updateTierBadge(tier) {
  const badge = document.getElementById('tier-badge');
  badge.className = `tier-badge tier-${tier}`;
  badge.textContent = tier.charAt(0).toUpperCase() + tier.slice(1);
}
```

```css
.tier-badge {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
}
.tier-free { background: #E5E7EB; color: #6B7280; }
.tier-email { background: #DBEAFE; color: #1D4ED8; }
.tier-premium { background: #FEF3C7; color: #B45309; }
```

### Email Capture Modal

```javascript
// Show email capture modal
function showEmailModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content">
      <h2>Unlock More Features</h2>
      <p>Provide your email to get additional daily uses.</p>
      <input type="email" id="email-input" placeholder="your@email.com">
      <label>
        <input type="checkbox" id="newsletter-checkbox">
        Send me tips and updates
      </label>
      <div class="modal-actions">
        <button onclick="closeModal()">Cancel</button>
        <button onclick="submitEmail()" class="primary">Unlock</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

async function submitEmail() {
  const email = document.getElementById('email-input').value;
  const newsletter = document.getElementById('newsletter-checkbox').checked;

  const response = await fetch('/v1/entitlement/unlock', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      deviceId: getDeviceId(),
      email,
      newsletter,
    }),
  });

  const data = await response.json();
  if (data.success) {
    // Update cache
    localStorage.setItem(CACHE_KEYS.entitlement, JSON.stringify(data.data));
    localStorage.setItem(CACHE_KEYS.cacheDate, new Date().toISOString());
    updateTierUI(data.data);
    closeModal();
    showSuccessToast('Account upgraded!');
  }
}
```

### Code Redemption Modal

```javascript
async function submitCode() {
  const code = document.getElementById('code-input').value.trim().toUpperCase();

  const response = await fetch('/v1/codes/redeem', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      deviceId: getDeviceId(),
      code,
    }),
  });

  const data = await response.json();
  if (data.success) {
    // Refresh entitlement from server
    const entitlement = await getEntitlement(true);
    updateTierUI(entitlement);
    closeModal();
    showSuccessToast(`Premium unlocked! Expires: ${formatDate(data.data.expiresAt)}`);
  } else {
    showError(data.error || 'Invalid code');
  }
}
```

---

## Tier Configuration Patterns

### Different Apps, Different Limits

Each app has unique limits per tier based on its resource usage:

```typescript
// Gear Guru (Vision AI - expensive)
export const GEAR_GURU_LIMITS = {
  free: { analysesPerDay: 3, comparisonsPerDay: 5 },
  email: { analysesPerDay: 10, comparisonsPerDay: 20 },
  premium: { analysesPerDay: -1, comparisonsPerDay: -1 },
};

// Scout Quizzer (Text AI - cheaper)
export const QUIZZER_LIMITS = {
  free: { questionsPerDay: 5, availableTopics: 4 },
  email: { questionsPerDay: 15, availableTopics: 7 },
  premium: { questionsPerDay: -1, availableTopics: 10 },
};

// Requirements Coach (Mixed AI)
export const REQUIREMENTS_LIMITS = {
  free: { queriesPerDay: 5, historyDays: 7 },
  email: { queriesPerDay: 15, historyDays: 30 },
  premium: { queriesPerDay: -1, historyDays: -1 },
};
```

### Content Gating by Tier

Some apps gate content (topics, badges, checklists) by tier:

```typescript
// Scout Quizzer - Topic access by tier
export const FREE_TOPICS = ['scout_oath', 'scout_law', 'lnt_principles', 'camping'];
export const EMAIL_TOPICS = [...FREE_TOPICS, 'outdoor_code', 'knots', 'campcraft'];
export const PREMIUM_TOPICS = ['first_aid', 'navigation', 'wilderness_survival'];

export function getAvailableTopics(tier: string): string[] {
  switch (tier) {
    case 'premium': return [...EMAIL_TOPICS, ...PREMIUM_TOPICS];
    case 'email': return EMAIL_TOPICS;
    default: return FREE_TOPICS;
  }
}

// Merit Badge Coach - Badge access by tier
export const TIER_LIMITS = {
  free: { badgeAccess: ['first-aid'] },
  email: { badgeAccess: ['first-aid', 'citizenship-community'] },
  premium: { badgeAccess: 'all' as const },
};
```

---

## Code Redemption System

### Code Types

| Type | Duration | Source | Use Case |
|------|----------|--------|----------|
| **Promo** | 30 days | Marketing campaigns | Short-term promotions (SCOUT2026) |
| **Troop** | 1 year | Troop leaders | Group access for Scout units |
| **Beta** | Lifetime | Beta program | Early tester rewards |

### Creating Codes

```sql
-- Promo code (30 days, unlimited uses, expires in 3 months)
INSERT INTO codes (code, code_type, tier_grant, duration_days, max_uses, expires_at)
VALUES ('SCOUT2026', 'promo', 'premium', 30, NULL, '2026-04-01');

-- Troop code (1 year, limited to 50 scouts)
INSERT INTO codes (code, code_type, tier_grant, duration_days, max_uses)
VALUES ('TROOP123ABC', 'troop', 'premium', 365, 50);

-- Beta code (lifetime, single use)
INSERT INTO codes (code, code_type, tier_grant, duration_days, max_uses)
VALUES ('BETA-XYZ123', 'beta', 'premium', NULL, 1);
```

### Code Validation Logic

```typescript
async function validateAndRedeemCode(deviceId: string, code: string) {
  // Find the code
  const codeRecord = await db.query(
    'SELECT * FROM codes WHERE code = $1',
    [code.toUpperCase()]
  );

  if (!codeRecord) {
    throw new Error('Invalid code');
  }

  // Check if code expired
  if (codeRecord.expires_at && new Date(codeRecord.expires_at) < new Date()) {
    throw new Error('Code has expired');
  }

  // Check if max uses reached
  if (codeRecord.max_uses && codeRecord.current_uses >= codeRecord.max_uses) {
    throw new Error('Code has reached maximum uses');
  }

  // Check if device already redeemed this code
  const existingRedemption = await db.query(
    'SELECT * FROM redemptions WHERE device_id = $1 AND code_id = $2',
    [deviceId, codeRecord.id]
  );

  if (existingRedemption) {
    throw new Error('Code already redeemed');
  }

  // Calculate expiration for entitlement
  let expiresAt = null;
  if (codeRecord.duration_days) {
    expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + codeRecord.duration_days);
  }

  // Update entitlement
  await db.query(`
    INSERT INTO entitlements (device_id, tier, source, expires_at)
    VALUES ($1, $2, 'code_redeem', $3)
    ON CONFLICT (device_id) DO UPDATE
    SET tier = $2, source = 'code_redeem', expires_at = $3, updated_at = NOW()
  `, [deviceId, codeRecord.tier_grant, expiresAt]);

  // Record redemption
  await db.query(
    'INSERT INTO redemptions (device_id, code_id) VALUES ($1, $2)',
    [deviceId, codeRecord.id]
  );

  // Increment use count
  await db.query(
    'UPDATE codes SET current_uses = current_uses + 1 WHERE id = $1',
    [codeRecord.id]
  );

  return {
    tier: codeRecord.tier_grant,
    codeType: codeRecord.code_type,
    expiresAt,
  };
}
```

---

## Analytics Event Tracking

### Standard Events (All Apps)

| Event | Trigger | Data |
|-------|---------|------|
| `app_opened` | App launch | platform, tier |
| `upgrade_prompt_shown` | Show upgrade UI | currentTier, location |
| `email_captured` | Submit email | success |
| `code_redeemed` | Submit code | success, codeType |

### App-Specific Events

```typescript
// Gear Guru
{ event: 'analysis_started', data: { tripType: 'weekend_campout' } }
{ event: 'analysis_completed', data: { itemCount: 15 } }
{ event: 'comparison_completed', data: { readinessScore: 87 } }

// Scout Quizzer
{ event: 'quiz_started', data: { topicId: 'scout_law', difficulty: 'beginner' } }
{ event: 'quiz_completed', data: { score: 8, total: 10, duration: 120 } }
{ event: 'streak_updated', data: { streakDays: 5 } }

// Merit Badge Coach
{ event: 'badge_selected', data: { badgeId: 'first-aid' } }
{ event: 'chat_sent', data: { badgeId: 'first-aid' } }
{ event: 'review_submitted', data: { badgeId: 'camping', requirementId: '1a' } }
```

### Client-Side Event Batching

```javascript
// Batch events and send periodically
const eventQueue = [];
const BATCH_INTERVAL = 30000; // 30 seconds

function trackEvent(event, data = {}) {
  eventQueue.push({
    event,
    timestamp: new Date().toISOString(),
    data,
  });
}

async function flushEvents() {
  if (eventQueue.length === 0) return;

  const events = [...eventQueue];
  eventQueue.length = 0;

  try {
    await fetch('/v1/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: getDeviceId(),
        platform: 'web',
        events,
      }),
    });
  } catch (error) {
    // Re-queue events on failure
    eventQueue.unshift(...events);
  }
}

// Flush on interval
setInterval(flushEvents, BATCH_INTERVAL);

// Flush on page unload
window.addEventListener('beforeunload', flushEvents);
```

---

## Reference Implementation: Scout App Studio

Scout App Studio is the reference implementation with 6 apps sharing a single middleware:

### Apps in the Suite

| App | Port | Purpose | Key Limits |
|-----|------|---------|------------|
| Scout Conference Simulator | 4400 | Role-play practice for Scout conferences | simulationsPerDay |
| Uniform Inspector | 4402 | AI-powered uniform photo analysis | inspectionsPerDay |
| Gear Guru | 4403 | Camera-based packing verification | analysesPerDay |
| Scout Quizzer | 4404 | Scenario-based knowledge quizzes | questionsPerDay |
| Requirements Coach | 4405 | Activity-to-requirement mapping | queriesPerDay |
| Merit Badge Coach | 4406 | AI-powered merit badge preparation | chatsPerDay, reviewsPerDay |
| **Middleware** | **4410** | Centralized entitlement service | — |

### Shared Benefits

1. **Single Code Redemption**: A troop code works across all 6 apps
2. **One Email, All Apps**: Provide email once, upgrade tier in all apps
3. **Unified Analytics**: Cross-app engagement metrics in one database
4. **Consistent UX**: Same upgrade modals, tier badges, and flows everywhere

### Directory Structure

```
/aiprojects/scouting/
├── scoutsim/            # App 1
├── uniforminspector/    # App 2
├── gearguru/            # App 3
├── scoutquizzer/        # App 4
├── requirementscoach/   # App 5
├── meritbadgecoach/     # App 6
├── middleware/          # Shared middleware service
└── ScoutAppSuite/       # Shared strategy docs
```

---

# APPENDIX: TEMPLATES & CHECKLISTS

---

## Quick Reference Commands

### Server (ExecFunc)
```bash
ssh efuncdev@157.245.191.245
cd /aiprojects/execfunc/{app}
claude
pm2 status
pm2 logs {app} --lines 100
pm2 restart {app}
git push
```

### Server (Scout Apps)
```bash
ssh scoutdev@157.245.191.245
cd /aiprojects/scouting/{app}
claude
pm2 status
pm2 logs {app} --lines 100
pm2 restart {app}
git push
```

### Mac
```bash
cd ~/projects/{app}
git pull
claude
open ios/{App}/{App}.xcodeproj
open -a "Android Studio" android/{App}
```

### API Testing
```bash
curl http://localhost:{port}/health
curl -X POST http://localhost:{port}/v1/analyze \
  -H "Content-Type: application/json" \
  -d '{"text":"test","source":"web"}'
```

---

## Complete New App Checklist

### Planning
- [ ] Define problem and user
- [ ] Create PRD
- [ ] Decide platforms (Web, iOS, Android, Chrome)
- [ ] Reserve ports
- [ ] Define monetization model
- [ ] Define free tier limits

### Server Infrastructure
- [ ] Create GitHub repo
- [ ] Create folder (or user if new category)
- [ ] Clone repo
- [ ] Set up port forwarding
- [ ] Create database (if needed)

### Backend Development
- [ ] Initialize project
- [ ] Create project structure
- [ ] Build API with Claude Code
- [ ] Add rate limiting middleware
- [ ] Write tests
- [ ] Start pm2

### Web Development
- [ ] Create web client
- [ ] **Apply ExecFunc Design System (NEW v5)**
- [ ] Add email capture UI
- [ ] Test all features
- [ ] Push to GitHub

### iOS Development (Mac)
- [ ] Pull repo
- [ ] Set up port forwarding
- [ ] Create Xcode project
- [ ] Build with Claude Code
- [ ] **Apply ExecFunc Design System (NEW v5)**
- [ ] **Implement collapsible sections (NEW v5)**
- [ ] **Add input controls (NEW v5)**
- [ ] Add device UUID (Keychain)
- [ ] Integrate StoreKit 2
- [ ] Test in Simulator
- [ ] Add Share Extension

### Chrome Extension (Mac)
- [ ] Create extension structure
- [ ] Build with Claude Code
- [ ] **Apply ExecFunc Design System (NEW v5)**
- [ ] **Implement collapsible sections (NEW v5)**
- [ ] **Add input controls (NEW v5)**
- [ ] Add device UUID (chrome.storage)
- [ ] Add email capture UI
- [ ] Test in Chrome

### Android Development (Mac)
- [ ] Create Android Studio project
- [ ] Build with Claude Code
- [ ] **Apply ExecFunc Design System (NEW v5)**
- [ ] **Implement collapsible sections (NEW v5)**
- [ ] **Add input controls (NEW v5)**
- [ ] Add device UUID (SharedPrefs)
- [ ] Integrate Google Billing
- [ ] Test in emulator (use 10.0.2.2!)
- [ ] Add Share Intent

### Launch
- [ ] Set up HTTPS
- [ ] Update client configs for production
- [ ] Submit to App Store
- [ ] Submit to Chrome Web Store
- [ ] Submit to Play Store

---

## Design System Checklist (NEW v5)

### Colors
- [ ] PhthaloPrimary (#4A3B5C) defined
- [ ] PhthaloAccent (#6B5B7E) defined
- [ ] PhthaloLightTint (#F5F3F7) defined
- [ ] LikelyColor (#22C55E) defined
- [ ] PossibleColor (#F59E0B) defined
- [ ] DangerRed (#DC2626) defined

### Input Screen
- [ ] Gradient background (PhthaloLightTint → White)
- [ ] Centered title in PhthaloPrimary
- [ ] Centered subtitle in gray
- [ ] White card for text input
- [ ] No placeholder text in input field
- [ ] Options card with dropdowns
- [ ] Dropdown for relationship type
- [ ] Dropdown for reply style
- [ ] Checkbox for Parent Mode
- [ ] Primary button in PhthaloPrimary
- [ ] "About this App" as expandable section

### Results Screen
- [ ] Collapsible sections with right/down arrows
- [ ] Primary content expanded by default
- [ ] Parent Perspective expanded by default
- [ ] Secondary content collapsed by default
- [ ] Likelihood badges use semantic colors
- [ ] Safety banners use DangerRed
- [ ] Cards have consistent styling

### Cross-Platform Parity
- [ ] Side-by-side comparison done
- [ ] Arrow directions match
- [ ] Default expansion states match
- [ ] Colors match
- [ ] Typography hierarchy matches
- [ ] Spacing/padding matches

---

## Middleware Integration Checklist (NEW v7)

### Middleware Service
- [ ] Create middleware project folder
- [ ] Reserve middleware port (e.g., 4410)
- [ ] Set up Neon PostgreSQL database
- [ ] Run schema migrations
- [ ] Implement `/v1/entitlement` endpoint
- [ ] Implement `/v1/email/capture` endpoint
- [ ] Implement `/v1/codes/redeem` endpoint
- [ ] Implement `/v1/events` endpoint
- [ ] Create initial promo codes
- [ ] Add to pm2 and start
- [ ] Test all endpoints

### App Backend Integration (Per App)
- [ ] Create `src/config/tierLimits.ts` with app-specific limits
- [ ] Create `src/services/middlewareClient.ts`
- [ ] Create `src/routes/entitlement.ts`
- [ ] Create `src/routes/codes.ts`
- [ ] Create `src/routes/events.ts`
- [ ] Register routes in index.ts
- [ ] Add MIDDLEWARE_URL to .env
- [ ] Test entitlement endpoint
- [ ] Test email unlock
- [ ] Test code redemption
- [ ] Test event tracking

### Web App Integration (Per App)
- [ ] Add 10-day entitlement caching
- [ ] Add connectivity warning banner (days 8-9)
- [ ] Add tier badge in header
- [ ] Add email capture modal
- [ ] Add code redemption modal
- [ ] Add upgrade section UI
- [ ] Track standard analytics events
- [ ] Track app-specific analytics events

### Mobile/Extension Integration (Future)
- [ ] Add middleware client to iOS
- [ ] Add middleware client to Android
- [ ] Add middleware client to Chrome extension
- [ ] Implement email capture flow on each platform
- [ ] Implement code redemption on each platform
- [ ] Add entitlement caching on each platform
- [ ] Add analytics tracking on each platform

---

## Version History

- v7 (Jan 2026): Cross-App Middleware for Suite Monetization (centralized entitlement, code redemption, analytics)
- v6 (Jan 2026): Added Scout App Studio (scoutdev user, 6 apps on ports 4400-4406), updated droplet specs (4 vCPU / 8GB RAM)
- v5 (Dec 2025): ExecFunc Design System, Collapsible Sections, Input Controls, Cross-Platform UI Consistency, Platform Gotchas
- v4 (Dec 2025): Monetization & Entitlements, Rate Limiting, Device Identity, IAP Integration
- v3 (Dec 2025): AI Pipeline Patterns, Cross-Platform JSON, Test Patterns
- v2 (Dec 2025): Chrome Extension, Android, Multi-Channel Workflows
- v1 (Dec 2025): Initial iOS + Backend patterns

---

_Update this document when adding new projects, reserving ports, changing infrastructure, or learning new patterns._
