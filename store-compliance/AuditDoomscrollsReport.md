# Compliance Report for Doomscrolls

**Generated:** January 13, 2026

---

## Section 2: App Information (Completed)

```yaml
app_name: "Doomscrolls"
app_slug: "doomscrolls"
one_liner: "Transform mindless scrolling into meaningful reading with classical literature"
portfolio: "other"
platforms:
  - web

# AI Usage
uses_ai: false
ai_provider: "None"
ai_provider_privacy_url: "N/A"
ai_data_sent: "N/A"
ai_purpose: "N/A"
# Note: OpenAI is used for batch embedding generation of the literary corpus,
# but NO user data is sent to AI services at runtime.

# Features
has_accounts: true
has_iap: false
has_social_features: true  # Following authors, public lists
has_user_generated_content: true  # List names, descriptions, notes

# Monetization
monetization_model: "free"
free_tier_limit: 1000
free_tier_unit: "API requests per day"

# Content
is_scout_app: false
professional_disclaimer: "N/A"
```

---

## Documents Generated

- [x] Privacy Policy (privacy-policy.md, privacy-policy.html)
- [x] Terms of Service (terms-of-service.md, terms-of-service.html)
- [x] App Store Description (app-store-description.md)
- [x] Keywords (keywords.md)
- [x] Age Rating Answers (age-rating.md)
- [ ] AI Consent Component Spec — N/A (app does not use runtime AI)

---

## Codebase Audit Results

### Legal Links
| Item | Status | Location |
|------|--------|----------|
| Privacy Policy link in app | **MISSING** | Not found in webapp |
| Terms of Service link in app | **MISSING** | Not found in webapp |
| Legal routes in API | **MISSING** | No /legal/* routes in server |

### Account Management
| Item | Status | Location |
|------|--------|----------|
| Account creation | **EXISTS** | `server/routes/auth.ts:19` - POST /api/auth/signup |
| Login/Logout | **EXISTS** | `server/routes/auth.ts:64,113` |
| Password change | **EXISTS** | `server/routes/auth.ts:257` |
| Account deletion UI | **MISSING** | Not found in webapp |
| Account deletion API | **MISSING** | No DELETE /api/auth/me endpoint |
| Data export | **MISSING** | No data export functionality |

### Rate Limiting
| Item | Status | Details |
|------|--------|---------|
| Rate limiting implemented | **YES** | `server/middleware/rateLimit.ts` |
| Current limit | 1000/day | Per device ID |
| Limit enforcement | Hard stop | Returns 429 when exceeded |

### AI Consent
| Item | Status | Notes |
|------|--------|-------|
| AI consent flow | **N/A** | App does not send user data to AI at runtime |
| Note | — | OpenAI is used only for batch corpus embedding generation |

### In-App Purchases
| Item | Status |
|------|--------|
| StoreKit/Billing integrated | N/A - No IAP |
| Restore Purchases button | N/A - No IAP |

### Store Assets
| Asset | Status | Notes |
|-------|--------|-------|
| App icon (1024x1024) | **MISSING** | Only vite.svg in public folder |
| App icon (512x512 - Android) | **MISSING** | — |
| App icon (128x128 - Chrome) | **MISSING** | — |
| Favicon | **MISSING** | — |
| Screenshots | **MISSING** | — |

### Native App Projects
| Platform | Status |
|----------|--------|
| iOS project | **DOES NOT EXIST** |
| Android project | **DOES NOT EXIST** |
| Chrome Extension | **DOES NOT EXIST** |

---

## Blockers Before Submission

### Critical (Must Fix)

1. **Add Privacy Policy link in app**
   - Required by all app stores
   - Add to footer/settings area

2. **Add Terms of Service link in app**
   - Required by all app stores
   - Add to footer/settings area

3. **Implement Account Deletion**
   - Required by Apple App Store (since 2022)
   - Required by Google Play Store
   - Must delete all user data (likes, bookmarks, follows, lists, reading progress)
   - Need both API endpoint and UI

4. **Create App Icons**
   - Need 1024x1024 for iOS
   - Need 512x512 for Android
   - Need various sizes for web favicon

5. **Add Legal Routes to API**
   - GET /legal/privacy - serve privacy policy HTML
   - GET /legal/terms - serve terms of service HTML

### High Priority (Should Fix)

6. **Add Screenshots for App Stores**
   - iOS: Various device sizes
   - Android: Phone and tablet

7. **Create Native App Projects** (if submitting to mobile stores)
   - iOS: Swift/SwiftUI or React Native
   - Android: Kotlin or React Native
   - Chrome: Manifest V3 extension

---

## Recommendations

### Nice to Have

1. **Add Data Export Feature**
   - Let users download their data (likes, bookmarks, lists)
   - Shows good faith for privacy compliance

2. **Add "About" or "Settings" Page**
   - Central location for legal links, version info, contact

3. **Implement Email Verification**
   - Currently `email_verified` field exists but not used
   - Good for account security

4. **Add Support Contact in App**
   - Link to mailto:support@dragondancepublishing.com

---

## Summary

| Category | Status |
|----------|--------|
| Privacy Policy Document | Done |
| Terms of Service Document | Done |
| Legal Links in App | **MISSING** |
| Account Deletion | **MISSING** |
| Rate Limiting | Done |
| App Icons | **MISSING** |
| Screenshots | **MISSING** |
| Native Apps | Not Started |

**Estimated Effort to Fix Blockers:**
- Backend/API: Low (1-2 hours)
- Web App: Low (1-2 hours)
- Design (icons/screenshots): Medium (requires design work)
